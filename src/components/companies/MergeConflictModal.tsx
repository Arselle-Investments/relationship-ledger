"use client";

import { useState } from "react";
import { ConflictField } from "@/lib/company-conflicts";

export function MergeConflictModal({
  conflicts,
  defaultValues,
  onCancel,
  onConfirm,
  busy,
}: {
  conflicts: ConflictField[];
  defaultValues: Record<string, string>;
  onCancel: () => void;
  onConfirm: (resolutions: Record<string, string>) => void;
  busy: boolean;
}) {
  const [choices, setChoices] = useState<Record<string, string>>(defaultValues);

  return (
    <div className="overlay open" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Resolve conflicting fields</h2>
          <button className="close-x" onClick={onCancel}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="helptext" style={{ marginBottom: 14 }}>
            These companies disagree on the fields below. Pick which value to keep. Everything else (tags, sources,
            notes, asset classes, deals) is combined automatically; nothing is lost.
          </div>
          {conflicts.map((c) => (
            <div key={c.field} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 4 }}>{c.label}</label>
              {c.options.map((opt) => (
                <label
                  key={opt.value}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name={c.field}
                    checked={choices[c.field] === opt.value}
                    onChange={() => setChoices((prev) => ({ ...prev, [c.field]: opt.value }))}
                  />
                  {opt.value}
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    ({opt.source})
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onConfirm(choices)} disabled={busy}>
            {busy ? "Merging…" : "Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
