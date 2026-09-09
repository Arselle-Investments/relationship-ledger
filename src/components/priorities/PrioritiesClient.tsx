"use client";

import { useMemo, useState } from "react";
import { Company, ContactTier } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS, CONTACT_TIER_LABELS } from "@/lib/contact-constants";
import { nextNQuarters } from "@/lib/quarters";
import { ContactWithRelations } from "@/types/contact";

const TIERS = [ContactTier.TIER_1, ContactTier.TIER_2, ContactTier.TIER_3];

type PriorityItem =
  | { kind: "contact"; id: string; name: string; sub: string; tier: ContactTier | null; quarter: string | null; status: string; owner: string }
  | { kind: "company"; id: string; name: string; sub: string; tier: ContactTier | null; quarter: string | null; status: string; owner: string };

function cellStyle(n: number): { background: string; color: string } {
  if (n === 0) return { background: "transparent", color: "var(--ink)" };
  if (n < 2) return { background: "var(--brass-bg)", color: "var(--ink)" };
  if (n < 4) return { background: "#E7D3A6", color: "var(--ink)" };
  return { background: "var(--brass)", color: "#fff" };
}

export function PrioritiesClient({ contacts, companies }: { contacts: ContactWithRelations[]; companies: Company[] }) {
  const quarters = useMemo(() => nextNQuarters(4), []);
  const [selected, setSelected] = useState<{ tier: ContactTier; quarter: string } | null>(null);

  const items = useMemo<PriorityItem[]>(
    () => [
      ...contacts.map(
        (c): PriorityItem => ({
          kind: "contact",
          id: c.id,
          name: c.name,
          sub: c.org || "—",
          tier: c.tier,
          quarter: c.priorityQuarter,
          status: FUNDRAISING_STAGE_LABELS[c.status],
          owner: c.owner?.name || "—",
        })
      ),
      ...companies.map(
        (co): PriorityItem => ({
          kind: "company",
          id: co.id,
          name: co.name,
          sub: co.city || "—",
          tier: co.tier,
          quarter: co.priorityQuarter,
          status: "—",
          owner: "—",
        })
      ),
    ],
    [contacts, companies]
  );

  const matches = useMemo(() => {
    if (!selected) return [];
    return items.filter((i) => i.tier === selected.tier && i.quarter === selected.quarter);
  }, [items, selected]);

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a cell to see which contacts and companies sit in that tier and quarter
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
                const n = items.filter((i) => i.tier === tier && i.quarter === q).length;
                const style = cellStyle(n);
                return (
                  <div
                    key={q}
                    className="pri-cell"
                    style={style}
                    onClick={() => setSelected({ tier, quarter: q })}
                  >
                    <div className="pri-count">{n}</div>
                    <div className="clabel">item{n === 1 ? "" : "s"}</div>
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
                <div className="muted">Nothing flagged for this tier and quarter.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Organization / City</th>
                      <th>Status</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((i) => (
                      <tr key={`${i.kind}-${i.id}`}>
                        <td className="name-cell">{i.name}</td>
                        <td>
                          <span className={`tag ${i.kind === "contact" ? "brass" : "forest"}`}>
                            {i.kind === "contact" ? "Contact" : "Company"}
                          </span>
                        </td>
                        <td>{i.sub}</td>
                        <td className="muted">{i.status}</td>
                        <td className="muted">{i.owner}</td>
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
