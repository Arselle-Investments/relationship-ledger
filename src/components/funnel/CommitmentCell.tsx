"use client";

import { useState } from "react";
import { formatCommitment, parseCommitment } from "@/lib/commitment";

/** An investor's estimated commitment: read-only text, or click-to-edit for editors. */
export function CommitmentCell({
  value,
  canEdit,
  onSave,
}: {
  value: number | null;
  canEdit: boolean;
  onSave: (next: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const shown = value != null ? formatCommitment(value) : null;

  if (!canEdit) return shown ? <span>{shown}</span> : <span className="muted">—</span>;

  function commit() {
    const next = parseCommitment(draft);
    if (next === undefined) {
      setInvalid(true);
      return;
    }
    setEditing(false);
    setInvalid(false);
    if (next !== value) onSave(next);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder="e.g. 250k"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setInvalid(false);
          }
        }}
        style={{ width: 90, fontSize: 12.5, borderColor: invalid ? "var(--rust)" : undefined }}
      />
    );
  }

  return (
    <button
      type="button"
      className="btn small ghost"
      title="Click to set the estimated commitment"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value != null ? String(value) : "");
        setEditing(true);
      }}
      style={{ padding: "1px 8px", fontSize: 12.5, minWidth: 54 }}
    >
      {shown ?? <span className="muted">+ add</span>}
    </button>
  );
}
