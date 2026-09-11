"use client";

import { useState } from "react";

/** Checkbox multi-select over a set of known options, plus a write-in box so
 * a value that isn't in the list yet (a new asset class, a new strategy)
 * can still be added — it then shows up as just another checked option for
 * next time, since `options` is expected to include prior write-ins. */
export function MultiSelectWriteIn({
  options,
  selected,
  onChange,
  disabled,
  placeholder = "Add another…",
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const extra = selected.filter((s) => !options.includes(s));
  const allOptions = Array.from(new Set([...options, ...extra])).sort();

  function toggle(value: string) {
    if (disabled) return;
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function addWriteIn() {
    const value = draft.trim();
    setDraft("");
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
  }

  return (
    <div>
      {allOptions.length > 0 && (
        <div className="checkbox-list" style={{ maxHeight: 160, overflowY: "auto" }}>
          {allOptions.map((o) => (
            <label key={o}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} disabled={disabled} />
              {o}
            </label>
          ))}
        </div>
      )}
      {!disabled && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addWriteIn();
              }
            }}
          />
          <button type="button" className="btn small" onClick={addWriteIn}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
