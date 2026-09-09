"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CapitalSource, Consultant, FundraisingStage } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { buildStatusFunnelCounts, FUNDRAISING_STAGE_COLORS, fundraisingStageTextColor } from "@/lib/funnel";

type Kind = "capital-sources" | "consultants";

export function EmergingManagersFunnelClient({
  capitalSources,
  consultants,
}: {
  capitalSources: CapitalSource[];
  consultants: Consultant[];
}) {
  const [kind, setKind] = useState<Kind>("capital-sources");
  const [selected, setSelected] = useState<FundraisingStage | null>(null);

  const items: { id: string; name: string; outreachStatus: FundraisingStage }[] =
    kind === "capital-sources" ? capitalSources : consultants;
  const counts = useMemo(() => buildStatusFunnelCounts(items), [items]);
  const max = Math.max(1, ...counts.map((c) => c.count));

  const matches = useMemo(
    () => (selected ? items.filter((item) => item.outreachStatus === selected) : []),
    [items, selected]
  );

  function switchKind(next: Kind) {
    setKind(next);
    setSelected(null);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="view-toggle">
          <button className={kind === "capital-sources" ? "active" : ""} onClick={() => switchKind("capital-sources")}>
            Capital sources
          </button>
          <button className={kind === "consultants" ? "active" : ""} onClick={() => switchKind("consultants")}>
            Consultants
          </button>
        </div>
        <div className="spacer" />
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a stage to see who sits there
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        {counts.map(({ status, count }) => {
          const widthPct = Math.max(4, Math.round((count / max) * 100));
          return (
            <div
              key={status}
              onClick={() => setSelected(status)}
              style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, cursor: "pointer" }}
            >
              <div style={{ width: 140, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", flex: "none" }}>
                {FUNDRAISING_STAGE_LABELS[status]}
              </div>
              <div style={{ flex: 1, background: "var(--paper)", borderRadius: 6, overflow: "hidden", height: 28 }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: FUNDRAISING_STAGE_COLORS[status],
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
                <div className="muted">Nothing in this stage.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((item) => (
                      <tr key={item.id}>
                        <td className="name-cell">
                          <Link
                            href={`/${kind}/${item.id}`}
                            style={{ color: "inherit", textDecoration: "none" }}
                            onClick={() => setSelected(null)}
                          >
                            {item.name}
                          </Link>
                        </td>
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
