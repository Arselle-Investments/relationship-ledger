"use client";

import { useState } from "react";

export function CreateListFromFilterModal({
  contactIds,
  onClose,
  onCreated,
}: {
  contactIds: string[];
  onClose: () => void;
  onCreated: (listName: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        mode: "STATIC",
        contactIds,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onCreated(json.list.name);
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Create list from {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="helptext" style={{ marginBottom: 14 }}>
            Snapshots exactly who&rsquo;s showing under the current search and filters into a new mailing list.
            Members are tagged with the list&rsquo;s name right away, so Agora can see it too.
          </div>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Los Angeles investors" />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-foot">
          <span />
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Creating…" : "Create list"}
          </button>
        </div>
      </div>
    </div>
  );
}
