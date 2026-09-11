"use client";

import { useState } from "react";
import { Company } from "@prisma/client";
import { clusterByFuzzyName, groupKeyFor } from "@/lib/company-match";
import { MergePreviewModal, PreviewField } from "@/components/MergePreviewModal";
import { ManualMergePicker } from "./ManualMergePicker";
import { SourceTags } from "@/components/SourceTags";

type CompanyWithCounts = Company & { _count: { contacts: number; feedback: number; outreach: number }; fromAgora: boolean };

function defaultPrimary(cluster: CompanyWithCounts[]): string {
  // The name already in use on the real Companies tab (from Agora) wins when
  // there's exactly one such record in the cluster — that's the trusted one,
  // not whichever the messier capital-partner import happened to create.
  const agoraOnes = cluster.filter((c) => c.fromAgora);
  if (agoraOnes.length === 1) return agoraOnes[0].id;
  // Otherwise fall back to whichever has the most activity attached.
  const activity = (c: CompanyWithCounts) => c._count.contacts + c._count.feedback + c._count.outreach;
  return cluster.reduce((best, c) => (activity(c) > activity(best) ? c : best), cluster[0]).id;
}

type ClusterEntry = { cluster: CompanyWithCounts[]; looseMatch: boolean; fuzzyMatch?: boolean };

export function CompanyReviewClient({
  initialClusters,
  allCompanies,
  dismissedKeys,
  canEdit,
}: {
  initialClusters: ClusterEntry[];
  allCompanies: CompanyWithCounts[];
  dismissedKeys: string[];
  canEdit: boolean;
}) {
  const [clusters, setClusters] = useState(initialClusters);
  // Keyed by the cluster's own stable id (its member ids, sorted and joined)
  // rather than array position — see the same note in ContactReviewClient.
  // An index-keyed map here caused a real bug: after the first of several
  // sequential merges, every later "primary" pick silently pointed at
  // whatever id used to occupy that array slot, merging unrelated people
  // together.
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
    const found = clusterByFuzzyName(allCompanies, alreadyIds).filter(
      (cluster) => !dismissed.has(groupKeyFor(cluster.map((c) => c.id)))
    );
    setScanning(false);
    if (found.length === 0) {
      setScanMsg("No more possible duplicates found — abbreviations, typos, and close spellings included.");
      return;
    }
    setPrimaryByCluster((prev) => {
      const next = { ...prev };
      for (const cluster of found) {
        next[groupKeyFor(cluster.map((c) => c.id))] = defaultPrimary(cluster);
      }
      return next;
    });
    setClusters((prev) => [...prev, ...found.map((cluster) => ({ cluster, looseMatch: false, fuzzyMatch: true }))]);
    setScanMsg(`Found ${found.length} more possible match${found.length === 1 ? "" : "es"} — review below.`);
  }
  const [pendingPreview, setPendingPreview] = useState<{
    primaryId: string;
    secondaryIds: string[];
    fields: PreviewField[];
    tags: string[];
    sources: string[];
    onDone: () => void;
  } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function removeCluster(clusterKey: string) {
    setClusters((prev) => prev.filter((entry) => groupKeyFor(entry.cluster.map((c) => c.id)) !== clusterKey));
  }

  async function submitMerge(primaryId: string, secondaryIds: string[], resolutions?: Record<string, string>) {
    const res = await fetch("/api/companies/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, secondaryIds, resolutions }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, error: json.error as string | undefined };
  }

  async function openPreview(primaryId: string, secondaryIds: string[], onDone: () => void) {
    setError(null);
    setPreviewError(null);
    const res = await fetch("/api/companies/merge", {
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
      sources: p.sources ?? [],
      fields: [
        { key: "city", label: "City", value: p.city ?? "" },
        { key: "website", label: "Website", value: p.website ?? "" },
        { key: "linkedinUrl", label: "LinkedIn", value: p.linkedinUrl ?? "" },
        { key: "aum", label: "AUM", value: p.aum ?? "" },
        { key: "founded", label: "Founded", value: p.founded ?? "" },
        { key: "priorityQuarter", label: "Priority quarter", value: p.priorityQuarter ?? "" },
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

  async function mergeCluster(clusterKey: string, cluster: CompanyWithCounts[]) {
    const primaryId = primaryByCluster[clusterKey];
    const secondaryIds = cluster.filter((c) => c.id !== primaryId).map((c) => c.id);
    await openPreview(primaryId, secondaryIds, () => removeCluster(clusterKey));
  }

  async function dismissCluster(clusterKey: string, cluster: CompanyWithCounts[]) {
    setError(null);
    setBusyKey(clusterKey);
    const res = await fetch("/api/companies/merge-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyIds: cluster.map((c) => c.id) }),
    });
    setBusyKey(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    removeCluster(clusterKey);
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
        Companies that look like the same capital partner written differently
      </div>
      <div className="helptext" style={{ marginBottom: 20 }}>
        Grouped by name, ignoring case, punctuation, and endings like &ldquo;Inc.&rdquo; or &ldquo;Holdings.&rdquo;
        Nothing merges until you say so. Merging fills in anything the kept record is missing from the others
        and combines tags/sources; if a field genuinely conflicts, you choose which one&rsquo;s right and the
        other is kept as a note instead of dropped.
      </div>

      {canEdit && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn" onClick={runScan} disabled={scanning}>
            {scanning ? "Scanning…" : "Scan for more possible duplicates"}
          </button>
          <span className="helptext" style={{ marginLeft: 8 }}>
            Checks for abbreviations, typos, and close spellings beyond the matches above.
          </span>
          {scanMsg && <div className="helptext" style={{ marginTop: 8 }}>{scanMsg}</div>}
        </div>
      )}

      {canEdit && <ManualMergePicker companies={allCompanies} />}

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {clusters.length === 0 ? (
        <div className="empty">
          <h3>Nothing to review</h3>
          <div>No name-alike company clusters waiting on a decision.</div>
        </div>
      ) : (
        clusters.map(({ cluster, looseMatch, fuzzyMatch }) => {
          const key = groupKeyFor(cluster.map((c) => c.id));
          const primaryId = primaryByCluster[key];
          const busy = busyKey === key;
          const agoraCount = cluster.filter((c) => c.fromAgora).length;
          return (
            <div key={key} className="card" style={{ padding: 16, marginBottom: 14 }}>
              {looseMatch && (
                <div style={{ marginBottom: 10 }}>
                  <span className="tag brass">Possible match</span>{" "}
                  <span className="helptext" style={{ marginLeft: 4 }}>
                    Names share the same core once generic words (Capital, Partners, Group, etc.) are set aside.
                    Double check these are really the same firm before merging.
                  </span>
                </div>
              )}
              {fuzzyMatch && (
                <div style={{ marginBottom: 10 }}>
                  <span className="tag brass">Possible match</span>{" "}
                  <span className="helptext" style={{ marginLeft: 4 }}>
                    Names are close enough to be the same firm typed differently (a typo, spacing, or abbreviation).
                    Double check these are really the same firm before merging.
                  </span>
                </div>
              )}
              {agoraCount === 0 && (
                <div className="helptext" style={{ marginBottom: 10, color: "var(--rust)" }}>
                  None of these match an existing Agora record. Pick the name to keep manually.
                </div>
              )}
              <table style={{ marginBottom: 12, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "31%" }} />
                  <col style={{ width: "27%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th></th>
                    <th>Company</th>
                    <th>Source</th>
                    <th style={{ whiteSpace: "normal" }}>Contacts</th>
                    <th style={{ whiteSpace: "normal" }}>Deal feedback</th>
                    <th style={{ whiteSpace: "normal" }}>Deals sent</th>
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
                      <td className="name-cell">
                        {c.name}
                        {c.fromAgora && (
                          <span className="tag forest" style={{ marginLeft: 6 }}>
                            Agora
                          </span>
                        )}
                      </td>
                      <td className="muted"><SourceTags sources={c.sources} /></td>
                      <td className="muted">{c._count.contacts}</td>
                      <td className="muted">{c._count.feedback}</td>
                      <td className="muted">{c._count.outreach}</td>
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
          arrayFields={[
            { label: "Tags", values: pendingPreview.tags },
            { label: "Sources", values: pendingPreview.sources },
          ]}
          onCancel={() => setPendingPreview(null)}
          onConfirm={confirmPreview}
          busy={previewBusy}
        />
      )}
      {previewError && <div className="error-text" style={{ marginTop: 12 }}>{previewError}</div>}
    </div>
  );
}
