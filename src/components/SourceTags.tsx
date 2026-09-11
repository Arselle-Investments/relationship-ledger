/** Renders a record's source breadcrumbs as uniform pill tags so multiple
 * sources line up the same way the Tags column does, instead of a long
 * variable-width string throwing off row alignment in the review tables. */
export function SourceTags({ sources }: { sources: string[] }) {
  if (sources.length === 0) {
    return <span className="tag">Manually added</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {sources.map((s) => (
        <span key={s} className="tag">
          {s}
        </span>
      ))}
    </div>
  );
}
