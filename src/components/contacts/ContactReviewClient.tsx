"use client";

import { useMemo, useState } from "react";
import { Contact, User } from "@prisma/client";
import { clusterByFuzzyName, groupKeyFor } from "@/lib/contact-dedupe";
import { MergePreviewModal, PreviewField } from "@/components/MergePreviewModal";
import { contactSourceLabels } from "@/lib/contact-source";
import { SourceTags } from "@/components/SourceTags";

type ContactWithCounts = Contact & {
  owner: User | null;
  _count: { tasks: number; correspondence: number };
};

function activity(c: ContactWithCounts): number {
  return c._count.tasks + c._count.correspondence + (c.notes?.trim() ? 1 : 0) + c.tags.length;
}

function defaultPrimary(cluster: ContactWithCounts[]): string {
  return cluster.reduce((best, c) => (activity(c) > activity(best) ? c : best), cluster[0]).id;
}

type ClusterEntry = { cluster: ContactWithCounts[]; matchedBy: "email" | "name" | "fuzzy" };

export function ContactReviewClient({
  initialClusters,
  allContacts,
  dismissedKeys,
  canEdit,
}: {
  initialClusters: ClusterEntry[];
  allContacts: ContactWithCounts[];
  dismissedKeys: string[];
  canEdit: boolean;
}) {
  const [clusters, setClusters] = useState(initialClusters);
  // Keyed by the cluster's own stable id (its member ids, sorted and joined)
  // rather than array position — the array reshuffles every time a cluster
  // is merged, dismissed, or scanned in, and an index-keyed map would then
  // point a later cluster's "primary" pick at whatever id used to sit at
  // that same position, silently merging the wrong people together.
  const [primaryByCluster, setPrimaryByCluster] = useState<Record<string, string>>(
    Object.fromEntries(initialClusters.map((entry) => [groupKeyFor(entry.cluster.map((c) => c.id)), defaultPrimary(entry.cluster)]))
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  function runScan() {
    setScanning(true);
    setScanMsg(null);
    const alreadyIds = new Set(clusters.flatMap((entry) => entry.cluster.map((c) => c.id)));
    const dismissed = new Set(dismissedKeys);
    const found = clusterByFuzzyName(allContacts, alreadyIds).filter(
      (cluster) => !dismissed.has(groupKeyFor(cluster.map((c) => c.id)))
    );
    setScanning(false);
    if (found.length === 0) {
      setScanMsg("No more possible duplicates found — nicknames, typos, and close spellings included.");
      return;
    }
    setPrimaryByCluster((prev) => {
      const next = { ...prev };
      for (const cluster of found) {
        next[groupKeyFor(cluster.map((c) => c.id))] = defaultPrimary(cluster);
      }
      return next;
    });
    setClusters((prev) => [...prev, ...found.map((cluster) => ({ cluster, matchedBy: "fuzzy" as const }))]);
    setScanMsg(`Found ${found.length} more possible match${found.length === 1 ? "" : "es"} — review below.`);
  }

  const [manualOpen, setManualOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());
  const [manualPrimaryId, setManualPrimaryId] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const manualFiltered = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return allContacts.slice(0, 25);
    return allContacts.filter((c) => c.name.toLowerCase().includes(q) || (c.org ?? "").toLowerCase().includes(q)).slice(0, 25);
  }, [allContacts, manualSearch]);
  const manualSelected = allContacts.filter((c) => manualSelectedIds.has(c.id));

  function removeCluster(clusterKey: string) {
    setClusters((prev) => prev.filter((entry) => groupKeyFor(entry.cluster.map((c) => c.id)) !== clusterKey));
  }

  async function submitMerge(primaryId: string, secondaryIds: string[], resolutions?: Record<string, string>) {
    const res = await fetch("/api/contacts/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, secondaryIds, resolutions }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, error: json.error as string | undefined };
  }

  const [pendingPreview, setPendingPreview] = useState<{
    primaryId: string;
    secondaryIds: string[];
    fields: PreviewField[];
    tags: string[];
    onDone: () => void;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function openPreview(primaryId: string, secondaryIds: string[], onDone: () => void) {
    setError(null);
    setPreviewError(null);
    const res = await fetch("/api/contacts/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, secondaryIds, dryRun: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    const p = json.preview;
    setPendingPreview({
      primaryId,
      secondaryIds,
      tags: p.tags ?? [],
      fields: [
        { key: "org", label: "Organization", value: p.org ?? "" },
        { key: "email", label: "Email", value: p.email ?? "" },
        { key: "phone", label: "Phone", value: p.phone ?? "" },
        { key: "city", label: "City", value: p.city ?? "" },
        { key: "notes", label: "Notes", value: p.notes ?? "", multiline: true },
      ],
      onDone,
    });
  }

  async function confirmPreview(edited: Record<string, string>) {
    if (!pendingPreview) return;
    setPreviewBusy(true);
    setPreviewError(null);
    const result = await submitMerge(pendingPreview.primaryId, pendingPreview.secondaryIds, edited);
    setPreviewBusy(false);
    if (!result.ok) {
      setPreviewError(result.error ?? "Something went wrong.");
      return;
    }
    pendingPreview.onDone();
    setPendingPreview(null);
  }

  async function mergeCluster(clusterKey: string, cluster: ContactWithCounts[]) {
    const primaryId = primaryByCluster[clusterKey];
    const secondaryIds = cluster.filter((c) => c.id !== primaryId).map((c) => c.id);
    await openPreview(primaryId, secondaryIds, () => removeCluster(clusterKey));
  }

  async function dismissCluster(clusterKey: string, cluster: ContactWithCounts[]) {
    setError(null);
    setBusyKey(clusterKey);
    const res = await fetch("/api/contacts/merge-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: cluster.map((c) => c.id) }),
    });
    setBusyKey(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    removeCluster(clusterKey);
  }

  function toggleManual(id: string) {
    setManualSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setManualPrimaryId((prev) => prev || id);
  }

  function resetManual() {
    setManualSelectedIds(new Set());
    setManualPrimaryId("");
    setManualSearch("");
    setManualError(null);
    setManualOpen(false);
  }

  async function doManualMerge() {
    if (manualSelected.length < 2 || !manualPrimaryId) return;
    setManualError(null);
    const secondaryIds = manualSelected.filter((c) => c.id !== manualPrimaryId).map((c) => c.id);
    await openPreview(manualPrimaryId, secondaryIds, () => window.location.reload());
  }

  return (
    <div>
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="num">{clusters.length}</div>
          <div className="label">Possible duplicate groups</div>
        </div>
      </div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        Contacts that look like the same person written differently
      </div>
      <div className="helptext" style={{ marginBottom: 20 }}>
        Grouped by shared email, then by name. Nothing merges until you say so. Merging fills in anything the
        kept record is missing from the other and combines tags; if a field genuinely conflicts, the other
        value is kept as a note instead of dropped.
      </div>

      {canEdit && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn" onClick={runScan} disabled={scanning}>
            {scanning ? "Scanning…" : "Scan for more possible duplicates"}
          </button>
          <span className="helptext" style={{ marginLeft: 8 }}>
            Checks for nicknames, typos, and close spellings beyond the exact matches above.
          </span>
          {scanMsg && <div className="helptext" style={{ marginTop: 8 }}>{scanMsg}</div>}
        </div>
      )}

      {canEdit && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Merge contacts manually</div>
              <div className="helptext" style={{ marginTop: 2 }}>
                For duplicates that weren&rsquo;t automatically clustered above. Search and pick any two or more.
              </div>
            </div>
            <button className="btn small" onClick={() => (manualOpen ? resetManual() : setManualOpen(true))}>
              {manualOpen ? "Cancel" : "Merge contacts"}
            </button>
          </div>

          {manualOpen && (
            <div style={{ marginTop: 14 }}>
              <input
                type="text"
                placeholder="Search contacts…"
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                style={{ marginBottom: 10, width: "100%", maxWidth: 360 }}
              />
              <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 12 }}>
                {manualFiltered.length === 0 ? (
                  <div className="helptext" style={{ padding: 10 }}>
                    No contacts match.
                  </div>
                ) : (
                  manualFiltered.map((c) => (
                    <label
                      key={c.id}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}
                    >
                      <input type="checkbox" checked={manualSelectedIds.has(c.id)} onChange={() => toggleManual(c.id)} />
                      {c.name}
                      {c.org && (
                        <span className="muted" style={{ fontSize: 11.5 }}>
                          &middot; {c.org}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>

              {manualSelected.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="helptext" style={{ marginBottom: 6 }}>
                    {manualSelected.length} selected. Pick which one to keep as the primary record:
                  </div>
                  {manualSelected.map((c) => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0" }}>
                      <input type="radio" name="manual-primary" checked={manualPrimaryId === c.id} onChange={() => setManualPrimaryId(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}

              {manualError && <div className="error-text" style={{ marginBottom: 10 }}>{manualError}</div>}

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn small primary" onClick={doManualMerge} disabled={manualSelected.length < 2 || manualBusy}>
                  {manualBusy ? "Merging…" : `Merge ${manualSelected.length || ""} selected`}
                </button>
                <button className="btn small ghost" onClick={resetManual} disabled={manualBusy}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {clusters.length === 0 ? (
        <div className="empty">
          <h3>Nothing to review</h3>
          <div>No duplicate-looking contacts waiting on a decision.</div>
        </div>
      ) : (
        clusters.map(({ cluster, matchedBy }) => {
          const key = groupKeyFor(cluster.map((c) => c.id));
          const primaryId = primaryByCluster[key];
          const busy = busyKey === key;
          return (
            <div key={key} className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <span className="tag brass">
                  {matchedBy === "email" ? "Same email" : matchedBy === "name" ? "Same name" : "Possible match"}
                </span>
              </div>
              <table style={{ marginBottom: 12, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Organization</th>
                    <th>Email</th>
                    <th>Owner</th>
                    <th>Source</th>
                    <th>Tags</th>
                    <th>Tasks</th>
                    <th style={{ whiteSpace: "normal" }}>Correspondence</th>
                  </tr>
                </thead>
                <tbody>
                  {cluster.map((c) => (
                    <tr key={c.id}>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <input
                            type="radio"
                            name={`primary-${key}`}
                            checked={primaryId === c.id}
                            onChange={() => setPrimaryByCluster((prev) => ({ ...prev, [key]: c.id }))}
                          />
                        )}
                      </td>
                      <td className="name-cell">{c.name}</td>
                      <td className="muted">{c.org || "—"}</td>
                      <td className="muted">{c.email || "—"}</td>
                      <td className="muted">{c.owner?.name || "—"}</td>
                      <td className="muted"><SourceTags sources={contactSourceLabels(c)} /></td>
                      <td className="muted">{c.tags.length}</td>
                      <td className="muted">{c._count.tasks}</td>
                      <td className="muted">{c._count.correspondence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn small primary" onClick={() => mergeCluster(key, cluster)} disabled={busy}>
                    {busy ? "Working…" : "Merge into selected"}
                  </button>
                  <button className="btn small ghost" onClick={() => dismissCluster(key, cluster)} disabled={busy}>
                    Not duplicates
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {pendingPreview && (
        <MergePreviewModal
          title="Review before merging"
          fields={pendingPreview.fields}
          arrayFields={[{ label: "Tags", values: pendingPreview.tags }]}
          onCancel={() => setPendingPreview(null)}
          onConfirm={confirmPreview}
          busy={previewBusy}
        />
      )}
      {previewError && <div className="error-text" style={{ marginTop: 12 }}>{previewError}</div>}
    </div>
  );
}
