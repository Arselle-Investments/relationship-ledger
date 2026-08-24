"use client";

import { useState } from "react";
import { SEQUENCE_STEP_TYPES, SequenceStepInput } from "@/lib/sequence-template-schema";
import { SequenceTemplateClient } from "@/types/sequence-template";

function emptyStep(): SequenceStepInput {
  return { type: "Email", title: "", waitDays: 0 };
}

function TemplateEditor({
  template,
  onCancel,
  onSaved,
}: {
  template: SequenceTemplateClient | null;
  onCancel: () => void;
  onSaved: (t: SequenceTemplateClient) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [steps, setSteps] = useState<SequenceStepInput[]>(template?.steps ?? [emptyStep()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateStep(i: number, patch: Partial<SequenceStepInput>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (steps.some((s) => !s.title.trim())) {
      setError("Every step needs a title.");
      return;
    }
    setSaving(true);
    const res = await fetch(template ? `/api/sequence-templates/${template.id}` : "/api/sequence-templates", {
      method: template ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), steps }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onSaved(json.template);
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="field">
        <label>Template name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {steps.map((step, i) => (
        <div key={i} className="field-row" style={{ marginBottom: 8, alignItems: "end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Step {i + 1} type</label>
            <select value={step.type} onChange={(e) => updateStep(i, { type: e.target.value as SequenceStepInput["type"] })}>
              {SEQUENCE_STEP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Title</label>
            <input value={step.title} onChange={(e) => updateStep(i, { title: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 0, maxWidth: 120 }}>
            <label>Wait (days)</label>
            <input
              type="number"
              min={0}
              value={step.waitDays}
              onChange={(e) => updateStep(i, { waitDays: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <button
            className="btn small btn-danger"
            onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
            disabled={steps.length <= 1}
          >
            Remove
          </button>
        </div>
      ))}
      <button className="btn small" onClick={() => setSteps((prev) => [...prev, emptyStep()])} style={{ marginBottom: 14 }}>
        Add step
      </button>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save template"}
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SequenceTemplatesSection({
  initialTemplates,
  canEdit,
}: {
  initialTemplates: SequenceTemplateClient[];
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<SequenceTemplateClient | null | "new">(null);

  function upsertLocal(t: SequenceTemplateClient) {
    setTemplates((prev) => {
      const exists = prev.some((x) => x.id === t.id);
      return exists ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t];
    });
    setEditing(null);
  }

  async function handleDelete(t: SequenceTemplateClient) {
    if (!confirm(`Delete "${t.name}"? Contacts already on this sequence keep their existing steps.`)) return;
    const res = await fetch(`/api/sequence-templates/${t.id}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((x) => x.id !== t.id));
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 6 }}>Outreach sequence templates</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        Reusable multi-step follow-up plans that can be started on any contact from their detail view (coming in
        Phase 4).
      </div>

      {templates.map((t) =>
        editing === t ? null : (
          <div key={t.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              {canEdit && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn small" onClick={() => setEditing(t)}>
                    Edit
                  </button>
                  <button className="btn small btn-danger" onClick={() => handleDelete(t)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              {t.steps.map((s, i) => (
                <span key={i}>
                  {i > 0 && " → "}
                  {s.title} ({s.type}{s.waitDays > 0 ? `, +${s.waitDays}d` : ""})
                </span>
              ))}
            </div>
          </div>
        )
      )}

      {editing !== null && editing !== "new" && (
        <TemplateEditor template={editing} onCancel={() => setEditing(null)} onSaved={upsertLocal} />
      )}
      {editing === "new" && <TemplateEditor template={null} onCancel={() => setEditing(null)} onSaved={upsertLocal} />}

      {canEdit && editing === null && (
        <button className="btn" onClick={() => setEditing("new")}>
          Add sequence template
        </button>
      )}
    </div>
  );
}
