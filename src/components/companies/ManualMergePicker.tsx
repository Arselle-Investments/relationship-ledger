"use client";

import { useMemo, useState } from "react";
import { Company } from "@prisma/client";
import { MergePreviewModal, PreviewField } from "@/components/MergePreviewModal";

type CompanyWithCounts = Company & { _count: { contacts: number; feedback: number; outreach: number }; fromAgora: boolean };

export function ManualMergePicker({ companies }: { companies: CompanyWithCounts[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{ fields: PreviewField[]; tags: string[]; sources: string[] } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies.slice(0, 25);
    return companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 25);
  }, [companies, search]);

  const selected = companies.filter((c) => selectedIds.has(c.id));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPrimaryId((prev) => prev || id);
  }

  function reset() {
    setSelectedIds(new Set());
    setPrimaryId("");
    setSearch("");
    setPendingPreview(null);
    setError(null);
    setOpen(false);
  }

  async function openPreview() {
    if (selected.length < 2 || !primaryId) return;
    setError(null);
    const secondaryIds = selected.filter((c) => c.id !== primaryId).map((c) => c.id);
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
    });
  }

  async function confirmMerge(edited: Record<string, string>) {
    setError(null);
    setBusy(true);
    const secondaryIds = selected.filter((c) => c.id !== primaryId).map((c) => c.id);
    const res = await fetch("/api/companies/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, secondaryIds, resolutions: edited }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    // The auto-detected clusters above and their counts may reference one of
    // the ids just merged away — simplest to reload rather than try to keep
    // every derived list on the page in sync by hand.
    window.location.reload();
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Merge companies manually</div>
          <div className="helptext" style={{ marginTop: 2 }}>
            For duplicates that weren&rsquo;t automatically clustered above. Search and pick any two or more.
          </div>
        </div>
        <button className="btn small" onClick={() => (open ? reset() : setOpen(true))}>
          {open ? "Cancel" : "Merge companies"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <input
            type="text"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10, width: "100%", maxWidth: 360 }}
          />
          <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 12 }}>
            {filtered.length === 0 ? (
              <div className="helptext" style={{ padding: 10 }}>
                No companies match.
              </div>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}
                >
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggle(c.id)} />
                  {c.name}
                  {c.city && (
                    <span className="muted" style={{ fontSize: 11.5 }}>
                      &middot; {c.city}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="helptext" style={{ marginBottom: 6 }}>
                {selected.length} selected. Pick which one to keep as the primary record:
              </div>
              {selected.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 0" }}>
                  <input type="radio" name="manual-primary" checked={primaryId === c.id} onChange={() => setPrimaryId(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}

          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small primary" onClick={openPreview} disabled={selected.length < 2 || busy}>
              {busy ? "Merging…" : `Merge ${selected.length || ""} selected`}
            </button>
            <button className="btn small ghost" onClick={reset} disabled={busy}>
              Clear
            </button>
          </div>
        </div>
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
          onConfirm={confirmMerge}
          busy={busy}
        />
      )}
    </div>
  );
}
