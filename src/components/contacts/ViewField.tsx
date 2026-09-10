// Plain label+value row for a record's View mode — a bold small-caps label
// as the visual anchor, with a lighter, larger value underneath so the two
// don't compete for attention.
export function ViewField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          color: "var(--ink-soft)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 400, color: "var(--ink)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
        {value}
      </div>
    </div>
  );
}
