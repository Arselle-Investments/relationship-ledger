"use client";

import { useState } from "react";
import { Deliverable } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";
import { DeliverableWithContacts } from "@/types/deliverable";
import { computeDeliverableContacts, KNOWN_AGORA_DELIVERABLE_FIELDS } from "@/lib/deliverables";

export function DeliverableModal({
  entry,
  allContacts,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: DeliverableWithContacts | null;
  allContacts: ContactWithRelations[];
  onClose: () => void;
  onSaved: (entry: DeliverableWithContacts) => void;
  onDeleted: (id: string) => void;
}) {
  const isEdit = !!entry;
  const [name, setName] = useState(entry?.deliverable.name ?? "");
  const [tagMatchesText, setTagMatchesText] = useState((entry?.deliverable.tagMatches ?? []).join("\n"));
  const [customFieldKeysText, setCustomFieldKeysText] = useState((entry?.deliverable.customFieldKeys ?? []).join("\n"));
  const [notes, setNotes] = useState(entry?.deliverable.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function parseLines(text: string): string[] {
    return text
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const tagMatches = parseLines(tagMatchesText);
    const customFieldKeys = parseLines(customFieldKeysText);
    if (tagMatches.length === 0 && customFieldKeys.length === 0) {
      setError("Add at least one matching tag or Agora custom field.");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), tagMatches, customFieldKeys, notes: notes.trim() };

    const res = await fetch(isEdit ? `/api/deliverables/${entry!.deliverable.id}` : "/api/deliverables", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    const deliverable = json.deliverable as Deliverable;
    onSaved({ deliverable, contacts: computeDeliverableContacts(deliverable, allContacts) });
  }

  async function handleDelete() {
    if (!entry) return;
    if (!confirm(`Delete "${entry.deliverable.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/deliverables/${entry.deliverable.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(entry.deliverable.id);
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "Edit deliverable" : "Track a new deliverable"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Year End Letter" />
          </div>
          <div className="field">
            <label>Matching tags (one per line)</label>
            <textarea
              value={tagMatchesText}
              onChange={(e) => setTagMatchesText(e.target.value)}
              style={{ minHeight: 90, fontFamily: "'Work Sans',sans-serif" }}
              placeholder={"End Of Year Letter 2025"}
            />
            <div className="helptext">
              A contact counts as having received this if any of these appear (as a substring, case-insensitive) in
              one of their tags. Add more than one line when Agora has tagged the same thing more than one way — e.g.
              &ldquo;Hiawatha Recipient&rdquo; and &ldquo;Received Hiawatha Email 2026&rdquo; for the same send.
            </div>
          </div>
          <div className="field">
            <label>Matching Agora custom fields (one per line)</label>
            <textarea
              value={customFieldKeysText}
              onChange={(e) => setCustomFieldKeysText(e.target.value)}
              style={{ minHeight: 70, fontFamily: "'Work Sans',sans-serif" }}
              placeholder={"RECEIVED HIAWATHA EMAIL 2026"}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {KNOWN_AGORA_DELIVERABLE_FIELDS.filter((f) => !customFieldKeysText.includes(f)).map((f) => (
                <button
                  key={f}
                  type="button"
                  className="tag"
                  style={{ cursor: "pointer", border: "none" }}
                  onClick={() => setCustomFieldKeysText((prev) => (prev.trim() ? `${prev.trim()}\n${f}` : f))}
                >
                  + {f}
                </button>
              ))}
            </div>
            <div className="helptext">
              A contact counts as having received this if any of these Agora custom fields (not a tag — a genuinely
              different thing in Agora) has a real value on their record. Click a suggestion above to add it, or type
              the field name exactly as Agora exports it (all caps).
            </div>
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <input value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-foot">
          {isEdit ? (
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
