"use client";

import { useMemo, useState } from "react";
import { STALE_REASON_FILTER_LABELS, StaleContact, StaleReasonCode } from "@/lib/followups";

export function DataHygieneClient({ initialStale }: { initialStale: StaleContact[] }) {
  const [stale] = useState(initialStale);
  const [reasonFilter, setReasonFilter] = useState<Set<StaleReasonCode>>(new Set());
  const [ownerFilter, setOwnerFilter] = useState("");
  const [staleSearch, setStaleSearch] = useState("");

  const reasonCounts = useMemo(() => {
    const counts = new Map<StaleReasonCode, number>();
    for (const c of stale) {
      for (const r of c.staleReasons) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
    }
    return counts;
  }, [stale]);

  const staleOwners = useMemo(() => {
    const names = new Set<string>();
    for (const c of stale) if (c.owner?.name) names.add(c.owner.name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stale]);

  const filteredStale = useMemo(() => {
    const q = staleSearch.trim().toLowerCase();
    return stale.filter((c) => {
      if (reasonFilter.size > 0 && !c.staleReasons.some((r) => reasonFilter.has(r.code))) return false;
      if (ownerFilter && c.owner?.name !== ownerFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.org ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stale, reasonFilter, ownerFilter, staleSearch]);

  function toggleReason(code: StaleReasonCode) {
    setReasonFilter((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div>
      <div className="stat-row">
        <div className="stat-card">
          <div className="num">{stale.length}</div>
          <div className="label">Data hygiene flags</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Contacts flagged for missing or stale data, so the team can work through them and fix the source in Agora
        </div>
        <div className="spacer" />
        <a className="btn" href="/api/data-hygiene/export">
          Export to Excel
        </a>
      </div>

      {stale.length === 0 ? (
        <div className="empty">
          <h3>Nothing flagged</h3>
          <div>No stale or incomplete contacts.</div>
        </div>
      ) : (
        <>
          <div className="toolbar" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            {(Object.keys(STALE_REASON_FILTER_LABELS) as StaleReasonCode[])
              .filter((code) => reasonCounts.has(code))
              .map((code) => (
                <button
                  key={code}
                  className={`btn small ${reasonFilter.has(code) ? "primary" : ""}`}
                  onClick={() => toggleReason(code)}
                >
                  {STALE_REASON_FILTER_LABELS[code]} ({reasonCounts.get(code)})
                </button>
              ))}
            {reasonFilter.size > 0 && (
              <button className="btn small" onClick={() => setReasonFilter(new Set())}>
                Clear
              </button>
            )}
          </div>
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search name or org..."
              value={staleSearch}
              onChange={(e) => setStaleSearch(e.target.value)}
            />
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">All owners</option>
              {staleOwners.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div className="spacer" />
            <div className="helptext">
              {filteredStale.length} of {stale.length}
            </div>
          </div>
          {filteredStale.length === 0 ? (
            <div className="empty">
              <h3>No matches</h3>
              <div>Nothing flagged matches the current filters.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Owner</th>
                  <th>Why flagged</th>
                </tr>
              </thead>
              <tbody>
                {filteredStale.map((c) => (
                  <tr key={c.id}>
                    <td className="name-cell">{c.name}</td>
                    <td>{c.org || <span className="muted">—</span>}</td>
                    <td>{c.owner?.name || <span className="muted">—</span>}</td>
                    <td>
                      {c.staleReasons.map((r) => (
                        <span key={r.code} className="tag rust">
                          {r.label}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
