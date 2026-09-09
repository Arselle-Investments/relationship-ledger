"use client";

import { useState } from "react";
import Link from "next/link";
import { Deal, DealStatus } from "@prisma/client";
import { DEAL_ASSET_CLASS_OPTIONS, DEAL_STATUS_LABELS, DEAL_STATUS_TAG_CLASS } from "@/lib/deal-constants";

type DealWithCount = Deal & { _count: { feedback: number; outreach: number } };

export function DealsClient({ initialDeals, canEdit }: { initialDeals: DealWithCount[]; canEdit: boolean }) {
  const [deals, setDeals] = useState(initialDeals);
  const [statusFilter, setStatusFilter] = useState("");
  const [assetClassFilter, setAssetClassFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = deals.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (assetClassFilter && d.assetClass !== assetClassFilter) return false;
    return true;
  });

  async function createDeal() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), assetClass: assetClass.trim() || null }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setDeals((prev) =>
      [...prev, { ...json.deal, _count: { feedback: 0, outreach: 0 } }].sort((a, b) => a.name.localeCompare(b.name))
    );
    setName("");
    setAssetClass("");
    setAdding(false);
  }

  return (
    <div>
      <div className="toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.values(DealStatus).map((s) => (
            <option key={s} value={s}>
              {DEAL_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={assetClassFilter} onChange={(e) => setAssetClassFilter(e.target.value)}>
          <option value="">All asset classes</option>
          {DEAL_ASSET_CLASS_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add deal"}
          </button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="field-row">
            <div className="field">
              <label>Deal name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 999 Hiawatha" />
            </div>
            <div className="field">
              <label>Asset class (optional)</label>
              <select value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
                <option value="">— none yet —</option>
                {DEAL_ASSET_CLASS_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <button className="btn primary" onClick={createDeal} disabled={busy}>
            {busy ? "Adding…" : "Add deal"}
          </button>
        </div>
      )}

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {deals.length} deals
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No deals found</h3>
          <div>Add a deal to start compiling feedback on it.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Status</th>
              <th>Asset class</th>
              <th>Sent to</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} style={{ cursor: "pointer" }}>
                <td className="name-cell">
                  <Link href={`/deals/${d.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {d.name}
                  </Link>
                </td>
                <td>
                  <span className={`tag ${DEAL_STATUS_TAG_CLASS[d.status]}`}>
                    {DEAL_STATUS_LABELS[d.status]}
                  </span>
                </td>
                <td className="muted">{d.assetClass || "—"}</td>
                <td className="muted">{d._count.outreach}</td>
                <td className="muted">{d._count.feedback}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
