"use client";

import { useEffect, useState } from "react";
import { Correspondence, ContactStatusChange } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

type TimelineEntry =
  | { kind: "correspondence"; at: string; data: Correspondence }
  | { kind: "stageChange"; at: string; data: ContactStatusChange };

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

  if (entries === null || entries.length === 0) return null;

  return (
    <div className="activity-log">
      <label
        style={{
          display: "block",
          fontSize: 11.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          color: "var(--ink-soft)",
          marginBottom: 8,
        }}
      >
        Activity
      </label>
      {entries.map((entry) =>
        entry.kind === "correspondence" ? (
          <div key={`c-${entry.data.id}`} className="activity-item">
            <span className="when">{new Date(entry.at).toLocaleDateString()}</span> — {entry.data.subject || "(no subject)"}
            {entry.data.suggestionState === "PENDING" && entry.data.suggestedStatus && (
              <div style={{ marginTop: 4, padding: "6px 8px", background: "var(--forest-bg)", borderRadius: 6 }}>
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
        ) : (
          <div key={`s-${entry.data.id}`} className="activity-item">
            <span className="when">{new Date(entry.at).toLocaleDateString()}</span> —{" "}
            {entry.data.fromStatus ? `${FUNDRAISING_STAGE_LABELS[entry.data.fromStatus]} → ` : ""}
            {FUNDRAISING_STAGE_LABELS[entry.data.toStatus]}
            {entry.data.note ? `: ${entry.data.note}` : ""}
            {entry.data.source === "AI_SUGGESTED" && <span className="tag forest" style={{ marginLeft: 6 }}>AI-confirmed</span>}
          </div>
        )
      )}
    </div>
  );
}
