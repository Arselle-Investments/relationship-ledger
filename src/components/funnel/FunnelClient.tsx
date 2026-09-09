"use client";

import { useMemo, useState } from "react";
import { FundraisingStage } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { buildFunnelCounts, FUNDRAISING_STAGE_COLORS, fundraisingStageTextColor } from "@/lib/funnel";
import { ContactWithRelations } from "@/types/contact";

export function FunnelClient({ contacts }: { contacts: ContactWithRelations[] }) {
  const counts = useMemo(() => buildFunnelCounts(contacts), [contacts]);
  const max = Math.max(1, ...counts.map((c) => c.count));
  const [selected, setSelected] = useState<FundraisingStage | null>(null);

  const matches = useMemo(() => (selected ? contacts.filter((c) => c.status === selected) : []), [contacts, selected]);

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a stage to see which contacts sit there
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        {counts.map(({ status, count }) => {
          const widthPct = Math.max(4, Math.round((count / max) * 100));
          const color = FUNDRAISING_STAGE_COLORS[status];
          return (
            <div
              key={status}
              onClick={() => setSelected(status)}
              style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, cursor: "pointer" }}
            >
              <div style={{ width: 170, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", flex: "none" }}>
                {FUNDRAISING_STAGE_LABELS[status]}
              </div>
              <div style={{ flex: 1, background: "var(--paper)", borderRadius: 6, overflow: "hidden", height: 28 }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 6,
                    transition: "width .2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 8,
                  }}
                >
                  {widthPct > 14 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: fundraisingStageTextColor(status) }}>{count}</span>
                  )}
                </div>
              </div>
              <div style={{ width: 36, textAlign: "right", fontFamily: "'Poppins',sans-serif", fontWeight: 600, flex: "none" }}>
                {widthPct <= 14 ? count : ""}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="overlay open" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{FUNDRAISING_STAGE_LABELS[selected]}</h2>
              <button className="close-x" onClick={() => setSelected(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {matches.length === 0 ? (
                <div className="muted">No contacts in this stage.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Organization</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((c) => (
                      <tr key={c.id}>
                        <td className="name-cell">{c.name}</td>
                        <td>{c.org || <span className="muted">—</span>}</td>
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
