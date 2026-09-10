"use client";

import { useEffect, useState } from "react";
import { Correspondence } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

/**
 * Correspondence log for a Consultant or CapitalSource — same idea as
 * Contact's ActivityTimeline, minus the stage-history merge, since Emerging
 * Managers entities don't have their own change log yet, only a current
 * outreachStatus.
 */
export function EmCorrespondenceTimeline({
  entityType,
  entityId,
  canEdit,
  onStatusChanged,
}: {
  entityType: "consultant" | "capitalSource";
  entityId: string;
  canEdit: boolean;
  onStatusChanged?: () => void;
}) {
  const [items, setItems] = useState<Correspondence[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    const param = entityType === "consultant" ? "consultantId" : "capitalSourceId";
    fetch(`/api/correspondence?${param}=${entityId}`)
      .then((r) => r.json())
      .then((json) => setItems(json.correspondence ?? []));
  }

  useEffect(reload, [entityType, entityId]);

  async function confirmSuggestion(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/correspondence/${id}/confirm-suggestion`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      reload();
      onStatusChanged?.();
    }
  }

  async function dismissSuggestion(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/correspondence/${id}/dismiss-suggestion`, { method: "POST" });
    setBusyId(null);
    if (res.ok) reload();
  }

  if (items === null || items.length === 0) return null;

  return (
    <div className="activity-log" style={{ marginBottom: 20 }}>
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
        Correspondence
      </label>
      {items.map((item) => (
        <div key={item.id} className="activity-item">
          <span className="when">{new Date(item.receivedAt).toLocaleDateString()}</span> &middot; {item.subject || "(no subject)"}
          {item.suggestionState === "PENDING" && item.suggestedStatus && (
            <div style={{ marginTop: 4, padding: "6px 8px", background: "var(--forest-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "var(--ink)" }}>
                AI suggests: move to <strong>{FUNDRAISING_STAGE_LABELS[item.suggestedStatus]}</strong>
                {item.suggestionRationale ? ` · ${item.suggestionRationale}` : ""}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button className="btn small primary" disabled={busyId === item.id} onClick={() => confirmSuggestion(item.id)}>
                    Confirm
                  </button>
                  <button className="btn small ghost" disabled={busyId === item.id} onClick={() => dismissSuggestion(item.id)}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
