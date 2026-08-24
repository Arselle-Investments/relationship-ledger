"use client";

import { useEffect, useState } from "react";
import { ActiveSequence } from "@/lib/sequences";
import { SequenceTemplateClient } from "@/types/sequence-template";
import { ContactWithRelations } from "@/types/contact";

export function ContactSequenceSection({
  contact,
  canEdit,
  onUpdated,
}: {
  contact: ContactWithRelations;
  canEdit: boolean;
  onUpdated: (contact: ContactWithRelations) => void;
}) {
  const [templates, setTemplates] = useState<SequenceTemplateClient[] | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [busy, setBusy] = useState(false);

  const activeSequence = contact.activeSequence as unknown as ActiveSequence | null;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (activeSequence) return;
    fetch("/api/sequence-templates")
      .then((r) => r.json())
      .then((json) => {
        setTemplates(json.templates ?? []);
        if (json.templates?.[0]) setSelectedTemplateId(json.templates[0].id);
      });
  }, [activeSequence]);

  async function start() {
    if (!selectedTemplateId) return;
    setBusy(true);
    const res = await fetch(`/api/contacts/${contact.id}/sequence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: selectedTemplateId }),
    });
    setBusy(false);
    const json = await res.json();
    if (res.ok) onUpdated(json.contact);
  }

  async function advance() {
    setBusy(true);
    const res = await fetch(`/api/contacts/${contact.id}/sequence`, { method: "PATCH" });
    setBusy(false);
    const json = await res.json();
    if (res.ok) onUpdated(json.contact);
  }

  async function cancel() {
    if (!confirm(`Cancel this outreach sequence for ${contact.name}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/contacts/${contact.id}/sequence`, { method: "DELETE" });
    setBusy(false);
    const json = await res.json();
    if (res.ok) onUpdated(json.contact);
  }

  return (
    <div className="activity-log">
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Outreach sequence
        {activeSequence ? ` — ${activeSequence.templateName}${activeSequence.completed ? " (complete)" : ""}` : ""}
      </div>

      {activeSequence ? (
        <>
          {activeSequence.steps.map((s, i) => {
            const stepOverdue = !s.done && s.dueDate < today;
            return (
              <div key={i} className="activity-item">
                {s.done ? "✓" : stepOverdue ? <span className="overdue-badge">due</span> : "○"} {s.title}{" "}
                <span className="when">
                  &middot; {s.type}, {s.done ? `done ${s.doneDate}` : `due ${s.dueDate}`}
                </span>
              </div>
            );
          })}
          {canEdit && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              {!activeSequence.completed && (
                <button className="btn small" onClick={advance} disabled={busy}>
                  Mark next step done
                </button>
              )}
              <button className="btn small btn-danger" onClick={cancel} disabled={busy}>
                Cancel sequence
              </button>
            </div>
          )}
        </>
      ) : canEdit ? (
        templates === null ? (
          <div className="muted" style={{ fontSize: 12.5 }}>
            Loading templates…
          </div>
        ) : templates.length === 0 ? (
          <div className="muted" style={{ fontSize: 12.5 }}>
            No sequence templates yet — add one in Settings.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} style={{ flex: 1 }}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.steps.length} steps)
                </option>
              ))}
            </select>
            <button className="btn small primary" onClick={start} disabled={busy}>
              Start sequence
            </button>
          </div>
        )
      ) : (
        <div className="muted" style={{ fontSize: 12.5 }}>
          No active sequence.
        </div>
      )}
    </div>
  );
}
