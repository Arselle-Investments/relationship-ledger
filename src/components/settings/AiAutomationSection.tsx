"use client";

import { useState } from "react";
import { Settings } from "@prisma/client";

export function AiAutomationSection({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const [autoApply, setAutoApply] = useState(settings.autoApplyStageSuggestions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleToggle(next: boolean) {
    setAutoApply(next);
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApplyStageSuggestions: next }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setAutoApply(!next);
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 14 }}>AI stage suggestions</h3>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <input
          type="checkbox"
          checked={autoApply}
          disabled={!canEdit || saving}
          onChange={(e) => handleToggle(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>
          <div style={{ fontWeight: 600 }}>Auto-apply AI stage suggestions</div>
          <div className="helptext">
            When correspondence comes in, the AI reads it and proposes a new pipeline stage. By default that sits
            as a pending suggestion in the Inbox until someone confirms it. Turn this on to skip the review step and
            apply the suggested stage immediately — it&rsquo;s still logged on the contact&rsquo;s timeline (tagged
            &ldquo;Auto-applied&rdquo;, not &ldquo;AI-confirmed&rdquo;) so it&rsquo;s clear no one reviewed it by hand.
          </div>
        </span>
      </label>
      {saved && !saving && <div className="helptext" style={{ marginTop: 10 }}>Saved.</div>}
    </div>
  );
}
