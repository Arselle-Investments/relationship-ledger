"use client";

import { useMemo, useState } from "react";
import { EditLogEntry } from "@prisma/client";
import { fieldLabel } from "@/lib/edit-log";

function fmt(v: string | null): string {
  return v ?? "(none)";
}

export function EditLogClient({
  initialEntries,
  canEdit,
}: {
  initialEntries: EditLogEntry[];
  canEdit: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entityType))).sort(), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (entityFilter && e.entityType !== entityFilter) return false;
      if (q && !e.entityLabel.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, entityFilter, search]);

  async function undo(id: string) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/edit-log/${id}/undo`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, undone: true, undoneAt: new Date() } : e)));
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        A running record of who changed what, on contacts and companies
      </div>
      <div className="helptext" style={{ marginBottom: 20 }}>
        Every field-level change made through the app shows up here. Undo puts the field back to what it was, and
        logs that as a change too, so the record stays honest.
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {entityTypes.length > 1 && (
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="">All types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <div className="spacer" />
      </div>

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>Nothing logged yet</h3>
          <div>Edits to contacts and companies will start showing up here.</div>
        </div>
      ) : (
        filtered.map((entry) => (
          <div
            key={entry.id}
            className="card"
            style={{ padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}
          >
            <div style={{ flex: 1, fontSize: 13 }}>
              <strong>{entry.changedByName ?? "Someone"}</strong> changed <strong>{fieldLabel(entry.field)}</strong> on{" "}
              <strong>{entry.entityLabel}</strong>
              <span className="muted"> &middot; &ldquo;{fmt(entry.oldValue)}&rdquo; &rarr; &ldquo;{fmt(entry.newValue)}&rdquo;</span>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                {entry.entityType} &middot; {new Date(entry.createdAt).toLocaleString()}
                {entry.undone ? " · undone" : ""}
              </div>
            </div>
            {canEdit && !entry.undone && (
              <button className="btn small ghost" onClick={() => undo(entry.id)} disabled={busyId === entry.id}>
                {busyId === entry.id ? "Undoing…" : "Undo"}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
