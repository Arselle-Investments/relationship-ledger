"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Company, Contact, Deal, DealFeedback, FundraisingStage } from "@prisma/client";
import { FEEDBACK_STATUS_LABELS } from "@/lib/deal-constants";
import { FUNDRAISING_STAGES, FUNDRAISING_STAGE_COLORS, fundraisingStageTextColor } from "@/lib/funnel";

type FeedbackWithRelations = DealFeedback & { company: Company | null; contact: Contact | null };
type DealWithFeedback = Deal & { feedback: FeedbackWithRelations[] };

/**
 * One funnel per Active deal, not one funnel for every LP relationship —
 * most companies never get real per-deal feedback tracked, so scoping to
 * deals that are actually live keeps this to a manageable, meaningful size
 * instead of a firehose of empty/dormant stages.
 */
export function DealCapFunnelClient({ deals }: { deals: DealWithFeedback[] }) {
  return (
    <div>
      <div className="helptext" style={{ marginBottom: 16 }}>
        Feedback stages for each currently Active deal. Click a stage to see who&rsquo;s there.
      </div>
      {deals.length === 0 ? (
        <div className="empty">
          <h3>No active deals</h3>
          <div>Funnels show up here for deals marked Active on the Deals tab.</div>
        </div>
      ) : (
        deals.map((deal) => <DealFunnelCard key={deal.id} deal={deal} />)
      )}
    </div>
  );
}

function DealFunnelCard({ deal }: { deal: DealWithFeedback }) {
  const [expanded, setExpanded] = useState<FundraisingStage | null>(null);

  const counts = useMemo(
    () => FUNDRAISING_STAGES.map((status) => ({ status, count: deal.feedback.filter((f) => f.status === status).length })),
    [deal.feedback]
  );
  const max = Math.max(1, ...counts.map((c) => c.count));
  const rows = expanded ? deal.feedback.filter((f) => f.status === expanded) : [];

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Link href={`/deals/${deal.id}`} style={{ fontWeight: 600, fontSize: 15 }}>
          {deal.name}
        </Link>
        <span className="helptext" style={{ margin: 0 }}>
          {deal.feedback.length} piece{deal.feedback.length === 1 ? "" : "s"} of feedback
        </span>
      </div>

      {deal.feedback.length === 0 ? (
        <div className="helptext">No feedback logged yet for this deal.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <div key={c.status}>
                <div
                  onClick={() => setExpanded(expanded === c.status ? null : c.status)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  <div style={{ width: 160, fontSize: 12.5 }}>{FEEDBACK_STATUS_LABELS[c.status]}</div>
                  <div style={{ flex: 1, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.max(4, (c.count / max) * 100)}%`,
                        background: FUNDRAISING_STAGE_COLORS[c.status],
                        color: fundraisingStageTextColor(c.status),
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "3px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.count}
                    </div>
                  </div>
                </div>
                {expanded === c.status && (
                  <table style={{ marginBottom: 8 }}>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Contact</th>
                        <th>Notes</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((f) => (
                        <tr key={f.id}>
                          <td className="name-cell">{f.company?.name || <span className="muted">—</span>}</td>
                          <td className="muted">{f.contact?.name || "—"}</td>
                          <td className="muted" style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                            {f.notes || "—"}
                          </td>
                          <td className="muted">{new Date(f.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
