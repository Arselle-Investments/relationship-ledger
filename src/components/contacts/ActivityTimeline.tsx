"use client";

import { useEffect, useState } from "react";
import { Correspondence, ContactStatusChange } from "@prisma/client";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-constants";

type TimelineEntry =
  | { kind: "correspondence"; at: string; data: Correspondence }
  | { kind: "stageChange"; at: string; data: ContactStatusChange };

export function ActivityTimeline({ contactId }: { contactId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
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
  }, [contactId]);

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
          </div>
        ) : (
          <div key={`s-${entry.data.id}`} className="activity-item">
            <span className="when">{new Date(entry.at).toLocaleDateString()}</span> —{" "}
            {entry.data.fromStatus ? `${CONTACT_STATUS_LABELS[entry.data.fromStatus]} → ` : ""}
            {CONTACT_STATUS_LABELS[entry.data.toStatus]}
            {entry.data.note ? `: ${entry.data.note}` : ""}
          </div>
        )
      )}
    </div>
  );
}
