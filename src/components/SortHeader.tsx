"use client";

import { useState } from "react";

export type SortKey<F extends string> = { field: F; dir: "asc" | "desc" };

/** Click-to-sort state for a table: click a column to sort by it ascending,
 * click the same column again to flip direction. */
export function useSort<F extends string>(defaultField: F) {
  const [sortKey, setSortKey] = useState<SortKey<F>>({ field: defaultField, dir: "asc" });
  function toggleSort(field: F) {
    setSortKey((prev) => (prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
  }
  return { sortKey, toggleSort };
}

/** A <th> that's clickable to sort, showing an arrow when it's the active column. */
export function SortHeader<F extends string>({
  field,
  label,
  sortKey,
  onSort,
}: {
  field: F;
  label: string;
  sortKey: SortKey<F>;
  onSort: (field: F) => void;
}) {
  const active = sortKey.field === field;
  return (
    <th onClick={() => onSort(field)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {label}
      {active ? (sortKey.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
