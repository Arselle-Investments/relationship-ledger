"use client";

/** Fixed checkbox multi-select over a known set of options — no write-in
 * capability. Used for Company.targetAssetClasses/investmentStructures/
 * investmentStrategies, which were free-text write-in fields until they got
 * locked down to real enums on 2026-09-25 (see docs/data-cleanup-tracker.md).
 * Generic over the option type so it works directly with enum values; pass
 * `labels` to show a human label instead of the raw enum key. */
export function MultiSelectWriteIn<T extends string>({
  options,
  selected,
  onChange,
  disabled,
  labels,
}: {
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  labels?: Record<T, string>;
}) {
  function toggle(value: T) {
    if (disabled) return;
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="checkbox-list" style={{ maxHeight: 160, overflowY: "auto" }}>
      {options.map((o) => (
        <label key={o}>
          <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} disabled={disabled} />
          {labels ? labels[o] : o}
        </label>
      ))}
    </div>
  );
}
