"use client";

import { useEffect, useMemo, useState } from "react";
import { Correspondence, ContactStatusChange } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { FUNDRAISING_STAGE_COLORS, fundraisingStageTextColor } from "@/lib/funnel";

type TimelineEntry =
  | { kind: "correspondence"; at: string; data: Correspondence }
  | { kind: "stageChange"; at: string; data: ContactStatusChange };

const BODY_PREVIEW_LENGTH = 220;

function StagePill({ status }: { status: keyof typeof FUNDRAISING_STAGE_LABELS }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 20,
        background: FUNDRAISING_STAGE_COLORS[status],
        color: fundraisingStageTextColor(status),
      }}
    >
      {FUNDRAISING_STAGE_LABELS[status]}
    </span>
  );
}

export function ActivityTimeline({
  contactId,
  canEdit,
  onContactChanged,
}: {
  contactId: string;
  canEdit: boolean;
  /** Called after a suggestion is confirmed, since that changes the contact's own status. */
  onContactChanged?: () => void;
}) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function reload() {
    Promise.all([
      fetch(`/api/correspondence?contactId=${contactId}`).then((r) => r.json()),
      fetch(`/api/contacts/${contactId}/stage-history`).then((r) => r.json()),
    ]).then(([correspondenceJson, stageJson]) => {
      const correspondence: Correspondence[] = correspondenceJson.correspondence ?? [];
      const stageChanges: ContactStatusChange[] = stageJson.stageChanges ?? [];
      const merged: TimelineEntry[] = [
        ...correspondence.map((c) => ({ kind: "correspondence" as const, at: c.receivedAt as unknown as string, data: c })),
        ...stageChanges.map((s) => ({ kind: "stageChange" as const, at: s.createdAt as unknown as string, data: s })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEntries(merged);
    });
  }

  useEffect(reload, [contactId]);

  const stageChangeCount = useMemo(() => (entries ?? []).filter((e) => e.kind === "stageChange").length, [entries]);
  const correspondenceCount = useMemo(() => (entries ?? []).filter((e) => e.kind === "correspondence").length, [entries]);

  async function confirmSuggestion(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/correspondence/${id}/confirm-suggestion`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      reload();
      onContactChanged?.();
    }
  }

  async function dismissSuggestion(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/correspondence/${id}/dismiss-suggestion`, { method: "POST" });
    setBusyId(null);
    if (res.ok) reload();
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (entries === null) return null; // still loading — avoid a flash of the empty state

  return (
    <div className="timeline-wrap">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <label
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".04em",
            color: "var(--ink-soft)",
          }}
        >
          Correspondence &amp; activity
        </label>
        {entries.length > 0 && (
          <span className="muted" style={{ fontSize: 11 }}>
            {correspondenceCount} exchange{correspondenceCount === 1 ? "" : "s"} · {stageChangeCount} stage change
            {stageChangeCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {entries.length === 0 && (
        <div className="muted" style={{ fontSize: 12.5 }}>No correspondence or stage changes on file yet for this contact.</div>
      )}
      {entries.length > 0 && (
        <div className="timeline">
          {entries.map((entry) =>
            entry.kind === "correspondence" ? (
              <div key={`c-${entry.data.id}`} className="timeline-row">
                <div className="timeline-rail">
                  <span className="timeline-dot correspondence" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-head">
                    <span className="timeline-date">{new Date(entry.at).toLocaleDateString()}</span>
                    <span className="timeline-subject">{entry.data.subject || "(no subject)"}</span>
                  </div>
                  {entry.data.bodyText && entry.data.bodyText.trim() && (
                    <div className="timeline-body">
                      {entry.data.bodyText.trim().slice(0, expandedIds.has(entry.data.id) ? 4000 : BODY_PREVIEW_LENGTH)}
                      {entry.data.bodyText.trim().length > BODY_PREVIEW_LENGTH && (
                        <>
                          {!expandedIds.has(entry.data.id) && "… "}
                          <button
                            type="button"
                            className="timeline-expand"
                            onClick={() => toggleExpanded(entry.data.id)}
                          >
                            {expandedIds.has(entry.data.id) ? "Show less" : "Show more"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {entry.data.suggestionState === "PENDING" && entry.data.suggestedStatus && (
                    <div style={{ marginTop: 6, padding: "6px 8px", background: "var(--forest-bg)", borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: "var(--ink)" }}>
                        AI suggests: move to <strong>{FUNDRAISING_STAGE_LABELS[entry.data.suggestedStatus]}</strong>
                        {entry.data.suggestionRationale ? ` — ${entry.data.suggestionRationale}` : ""}
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button
                            className="btn small primary"
                            disabled={busyId === entry.data.id}
                            onClick={() => confirmSuggestion(entry.data.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn small ghost"
                            disabled={busyId === entry.data.id}
                            onClick={() => dismissSuggestion(entry.data.id)}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={`s-${entry.data.id}`} className="timeline-row milestone">
                <div className="timeline-rail">
                  <span className="timeline-dot milestone" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-head">
                    <span className="timeline-date">{new Date(entry.at).toLocaleDateString()}</span>
                    <span className="timeline-stage-change">
                      {entry.data.fromStatus && <StagePill status={entry.data.fromStatus} />}
                      {entry.data.fromStatus && <span className="muted" style={{ fontSize: 11 }}>→</span>}
                      <StagePill status={entry.data.toStatus} />
                      {entry.data.source === "AI_SUGGESTED" && (
                        <span className="tag forest">AI-confirmed</span>
                      )}
                    </span>
                  </div>
                  {entry.data.note && <div className="timeline-body">{entry.data.note}</div>}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
