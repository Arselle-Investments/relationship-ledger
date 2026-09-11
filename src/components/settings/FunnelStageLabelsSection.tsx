"use client";

import { useState } from "react";
import { FundraisingStage, Settings } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { PIPELINE_STAGES, DROPPED_STAGES } from "@/lib/funnel";

const ORDERED_STAGES = [...PIPELINE_STAGES, ...DROPPED_STAGES];

export function FunnelStageLabelsSection({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const overrides = (settings.funnelStageLabels as Partial<Record<FundraisingStage, string>> | null) ?? {};
  const [values, setValues] = useState<Record<FundraisingStage, string>>(() => {
    const initial = {} as Record<FundraisingStage, string>;
    for (const stage of ORDERED_STAGES) initial[stage] = overrides[stage] ?? FUNDRAISING_STAGE_LABELS[stage];
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setValue(stage: FundraisingStage, value: string) {
    setValues((prev) => ({ ...prev, [stage]: value }));
    setSaved(false);
  }

  function resetRow(stage: FundraisingStage) {
    setValue(stage, FUNDRAISING_STAGE_LABELS[stage]);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    // Only send rows that actually differ from the built-in default — an
    // empty JSON object means "every stage uses its default label."
    const funnelStageLabels: Partial<Record<FundraisingStage, string>> = {};
    for (const stage of ORDERED_STAGES) {
      const trimmed = values[stage].trim();
      if (trimmed && trimmed !== FUNDRAISING_STAGE_LABELS[stage]) funnelStageLabels[stage] = trimmed;
    }
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelStageLabels }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 24 }}>
      <h3 style={{ marginBottom: 6 }}>Funnel stage names</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        Rename how each stage reads on the Fund Raise &rarr; Funnel page. Doesn&rsquo;t change the underlying
        pipeline logic or any contact&rsquo;s actual stage — just the label shown here. Clear a row (or hit Reset)
        to go back to the default.
      </div>
      {ORDERED_STAGES.map((stage) => (
        <div key={stage} className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ width: 190, flex: "none", fontSize: 12.5, color: "var(--ink-soft)" }}>
            {FUNDRAISING_STAGE_LABELS[stage]}
          </label>
          <input
            type="text"
            value={values[stage]}
            disabled={!canEdit}
            onChange={(e) => setValue(stage, e.target.value)}
            style={{ flex: 1 }}
          />
          {canEdit && values[stage] !== FUNDRAISING_STAGE_LABELS[stage] && (
            <button className="btn small ghost" onClick={() => resetRow(stage)} type="button">
              Reset
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button className="btn primary" onClick={handleSave} disabled={saving} style={{ marginTop: 10 }}>
          {saving ? "Saving…" : saved ? "Saved" : "Save stage names"}
        </button>
      )}
    </div>
  );
}
