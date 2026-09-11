"use client";

import { useState } from "react";

export type PreviewField = { key: string; label: string; value: string; multiline?: boolean };

/**
 * Shows the record a merge would actually produce before it's committed —
 * every field editable, so a reviewer can catch and fix anything the
 * automatic fill-in-the-blanks logic got wrong (or just prefers written
 * differently) instead of discovering it only after the secondaries are
 * already gone.
 */
export function MergePreviewModal({
  title,
  fields,
  arrayFields,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  fields: PreviewField[];
  arrayFields?: { label: string; values: string[] }[];
  onCancel: () => void;
  onConfirm: (edited: Record<string, string>) => void;
  busy: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  );

  return (
    <div className="overlay open" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close-x" onClick={onCancel}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="helptext" style={{ marginBottom: 16 }}>
            This is the record that will be kept. Edit anything before confirming.
          </div>
          {fields.map((f) =>
            f.multiline ? (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <textarea
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ) : (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            )
          )}
          {arrayFields
            ?.filter((af) => af.values.length > 0)
            .map((af) => (
              <div className="field" key={af.label}>
                <label>{af.label}</label>
                <div>
                  {af.values.map((v) => (
                    <span key={v} className="tag" style={{ marginRight: 4, marginBottom: 4 }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onConfirm(values)} disabled={busy}>
            {busy ? "Merging…" : "Confirm merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
