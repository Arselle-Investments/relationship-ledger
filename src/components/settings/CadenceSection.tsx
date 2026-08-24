"use client";

import { useState } from "react";
import { Settings } from "@prisma/client";

export function CadenceSection({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const [cadence, setCadence] = useState(settings.defaultCadenceDays);
  const [staleDays, setStaleDays] = useState(settings.staleDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultCadenceDays: cadence, staleDays }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 14 }}>Follow-up cadence default</h3>
      <div className="field">
        <label>Nudge if no reply after (days)</label>
        <input
          type="number"
          min={1}
          value={cadence}
          onChange={(e) => setCadence(parseInt(e.target.value, 10) || 1)}
          disabled={!canEdit}
          style={{ maxWidth: 140 }}
        />
        <div className="helptext">
          Applies to every contact unless a per-contact override is set on that contact&rsquo;s record.
        </div>
      </div>
      <div className="field">
        <label>Flag as stale after (days), for data hygiene</label>
        <input
          type="number"
          min={1}
          value={staleDays}
          onChange={(e) => setStaleDays(parseInt(e.target.value, 10) || 1)}
          disabled={!canEdit}
          style={{ maxWidth: 140 }}
        />
      </div>
      {canEdit && (
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
        </button>
      )}
    </div>
  );
}
