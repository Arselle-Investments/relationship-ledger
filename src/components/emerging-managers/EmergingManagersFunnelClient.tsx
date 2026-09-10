"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CapitalSource, Consultant, FundraisingStage } from "@prisma/client";
import { EM_STAGE_LABELS } from "@/lib/contact-constants";
import { buildStatusFunnelCounts, FUNDRAISING_STAGE_COLORS } from "@/lib/funnel";

type Kind = "capital-sources" | "consultants";

export function EmergingManagersFunnelClient({
  capitalSources,
  consultants,
}: {
  capitalSources: CapitalSource[];
  consultants: Consultant[];
}) {
  const [kind, setKind] = useState<Kind>("capital-sources");
  const [expanded, setExpanded] = useState<Set<FundraisingStage>>(new Set());

  const items: { id: string; name: string; outreachStatus: FundraisingStage }[] =
    kind === "capital-sources" ? capitalSources : consultants;
  const counts = useMemo(() => buildStatusFunnelCounts(items), [items]);
  // NOT_STARTED is excluded from the scale and always drawn full — with it
  // included, its huge head-of-funnel count squashes every other stage into a
  // sliver. Every other bar still scales true-to-count against each other.
  const maxActive = Math.max(1, ...counts.filter((c) => c.status !== FundraisingStage.NOT_STARTED).map((c) => c.count));

  const matchesByStage = useMemo(() => {
    const map = new Map<FundraisingStage, typeof items>();
    for (const status of expanded) {
      map.set(
        status,
        items.filter((item) => item.outreachStatus === status).sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    return map;
  }, [items, expanded]);

  function switchKind(next: Kind) {
    setKind(next);
    setExpanded(new Set());
  }

  function toggleStage(status: FundraisingStage) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
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
          const widthPct =
            status === FundraisingStage.NOT_STARTED ? 100 : Math.max(4, Math.round((count / maxActive) * 100));
          const isOpen = expanded.has(status);
          const matches = matchesByStage.get(status) ?? [];
          return (
            <div key={status} style={{ marginBottom: 14 }}>
              <div
                onClick={() => toggleStage(status)}
                style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              >
                <div style={{ width: 170, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", flex: "none" }}>
                  {EM_STAGE_LABELS[status]}
                </div>
                <div style={{ flex: 1, background: "var(--paper)", borderRadius: 6, overflow: "hidden", height: 28 }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "100%",
                      background: FUNDRAISING_STAGE_COLORS[status],
                      borderRadius: 6,
                      transition: "width .2s",
                    }}
                  />
                </div>
                <div style={{ width: 36, textAlign: "right", fontFamily: "'Poppins',sans-serif", fontWeight: 600, flex: "none" }}>
                  {count}
                </div>
              </div>

              {isOpen && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 16,
                    background: "var(--paper-raised)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                  }}
                >
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
                              <Link href={`/${kind}/${item.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                                {item.name}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
