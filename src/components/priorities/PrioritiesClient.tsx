"use client";

import { useMemo, useState } from "react";
import { ContactTier } from "@prisma/client";
import { CONTACT_STATUS_LABELS, CONTACT_TIER_LABELS } from "@/lib/contact-constants";
import { nextNQuarters } from "@/lib/quarters";
import { ContactWithRelations } from "@/types/contact";

const TIERS = [ContactTier.TIER_1, ContactTier.TIER_2, ContactTier.TIER_3];

function cellStyle(n: number): { background: string; color: string } {
  if (n === 0) return { background: "transparent", color: "var(--ink)" };
  if (n < 2) return { background: "var(--brass-bg)", color: "var(--ink)" };
  if (n < 4) return { background: "#E7D3A6", color: "var(--ink)" };
  return { background: "var(--brass)", color: "#fff" };
}

export function PrioritiesClient({ contacts }: { contacts: ContactWithRelations[] }) {
  const quarters = useMemo(() => nextNQuarters(4), []);
  const [selected, setSelected] = useState<{ tier: ContactTier; quarter: string } | null>(null);

  const matches = useMemo(() => {
    if (!selected) return [];
    return contacts.filter((c) => c.tier === selected.tier && c.priorityQuarter === selected.quarter);
  }, [contacts, selected]);

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a cell to see which contacts sit in that tier and quarter
        </div>
      </div>

      <div id="pri-grid-wrap">
        <div id="pri-grid">
          <div className="pri-header-row">
            <div>Tier</div>
            {quarters.map((q) => (
              <div key={q}>{q}</div>
            ))}
          </div>
          {TIERS.map((tier) => (
            <div key={tier} className="pri-row">
              <div className="row-label">{CONTACT_TIER_LABELS[tier]}</div>
              {quarters.map((q) => {
                const n = contacts.filter((c) => c.tier === tier && c.priorityQuarter === q).length;
                const style = cellStyle(n);
                return (
                  <div
                    key={q}
                    className="pri-cell"
                    style={style}
                    onClick={() => setSelected({ tier, quarter: q })}
                  >
                    <div className="pri-count">{n}</div>
                    <div className="clabel">contact{n === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="overlay open" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>
                {CONTACT_TIER_LABELS[selected.tier]} &middot; {selected.quarter}
              </h2>
              <button className="close-x" onClick={() => setSelected(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {matches.length === 0 ? (
                <div className="muted">No contacts flagged for this tier and quarter.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Organization</th>
                      <th>Status</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((c) => (
                      <tr key={c.id}>
                        <td className="name-cell">{c.name}</td>
                        <td>{c.org || <span className="muted">—</span>}</td>
                        <td>{CONTACT_STATUS_LABELS[c.status]}</td>
                        <td className="muted">{c.owner?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
