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
  const [platformFilter, setPlatformFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [platform, setPlatform] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const platforms = Array.from(new Set(deals.map((d) => d.platform).filter((p): p is string => !!p))).sort((a, b) =>
    a.localeCompare(b)
  );

  const filtered = deals.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (assetClassFilter && d.assetClass !== assetClassFilter) return false;
    if (platformFilter && d.platform !== platformFilter) return false;
    return true;
  });

  // Active = still being worked (including under contract); dormant/dead drop to a second section below.
  const activeDeals = filtered.filter((d) => d.status === DealStatus.ACTIVE || d.status === DealStatus.UNDER_CONTRACT);
  const inactiveDeals = filtered.filter((d) => d.status === DealStatus.DORMANT || d.status === DealStatus.DEAD);

  function dealsTable(rows: DealWithCount[]) {
    return (
      <table style={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: "26%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "13%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Deal</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Asset class</th>
            <th>Sent to</th>
            <th>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} style={{ cursor: "pointer" }}>
              <td className="name-cell">
                <Link href={`/deals/${d.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                  {d.name}
                </Link>
              </td>
              <td className="muted">{d.platform || "—"}</td>
              <td>
                <span className={`tag ${DEAL_STATUS_TAG_CLASS[d.status]}`}>{DEAL_STATUS_LABELS[d.status]}</span>
              </td>
              <td className="muted">{d.assetClass || "—"}</td>
              <td className="muted">{d._count.outreach}</td>
              <td className="muted">{d._count.feedback}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

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
      body: JSON.stringify({ name: name.trim(), assetClass: assetClass.trim() || null, platform: platform.trim() || null }),
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
    setPlatform("");
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
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
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
              <label>Platform (optional)</label>
              <input
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                list="deal-platforms"
                placeholder="e.g. Kearny"
              />
              <datalist id="deal-platforms">
                {platforms.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
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
        <>
          {activeDeals.length > 0 && dealsTable(activeDeals)}
          {inactiveDeals.length > 0 && (
            <>
              <h3 style={{ margin: "28px 0 4px" }}>Inactive deals</h3>
              <div className="helptext" style={{ marginBottom: 12 }}>
                {inactiveDeals.length} dormant or dead
              </div>
              {dealsTable(inactiveDeals)}
            </>
          )}
        </>
      )}
    </div>
  );
}
