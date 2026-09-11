"use client";

/** Ascending bar meter (1-5) for a team judgment call on close probability — deliberately not stars, since this isn't rating a person. */
export function ProbabilityBars({
  value,
  canEdit,
  onChange,
  size = "md",
}: {
  value: number | null;
  canEdit: boolean;
  onChange: (next: number | null) => void;
  size?: "sm" | "md";
}) {
  const unit = size === "sm" ? 6 : 7;
  return (
    <div
      style={{ display: "flex", gap: 2, alignItems: "flex-end" }}
      onClick={(e) => e.stopPropagation()}
      title={value != null ? `${value} of 5` : "Not rated"}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => canEdit && onChange(value === n ? null : n)}
          style={{
            cursor: canEdit ? "pointer" : "default",
            display: "inline-block",
            width: unit,
            height: unit - 1 + n * (unit / 3.5),
            borderRadius: 1,
            background: value != null && n <= value ? "var(--brass-dark)" : "var(--line)",
          }}
        />
      ))}
    </div>
  );
}
