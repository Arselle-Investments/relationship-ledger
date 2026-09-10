"use client";

import { useState } from "react";
import { TaskPriority, TaskStatus, User } from "@prisma/client";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/task-constants";

export function BulkTaskModal({
  contactIds,
  contactCount,
  team,
  onClose,
  onCreated,
}: {
  contactIds: string[];
  /** Label only — separate from contactIds.length so "all" can read as a stage's true count. */
  contactCount: number;
  team: User[];
  onClose: () => void;
  onCreated: (count: number) => void;
}) {
  const [title, setTitle] = useState("");
  const pairOptions = team.flatMap((a, i) =>
    team.slice(i + 1).map((b) => ({ value: `pair:${a.id},${b.id}`, label: `${a.name || a.email} or ${b.name || b.email}` }))
  );
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.OPEN);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    let ownerId: string | null = null;
    let assigneeLabel: string | null = null;
    if (assignee === "team") {
      assigneeLabel = "Team";
    } else if (assignee.startsWith("pair:")) {
      assigneeLabel = pairOptions.find((p) => p.value === assignee)?.label ?? null;
    } else if (assignee) {
      ownerId = assignee;
    }
    const res = await fetch("/api/tasks/bulk-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds,
        title: title.trim(),
        ownerId,
        assigneeLabel,
        dueDate: dueDate || null,
        status,
        priority,
        notes,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onCreated(json.created);
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Create task for {contactCount} contact{contactCount === 1 ? "" : "s"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="helptext" style={{ marginBottom: 14 }}>
            One task, created separately for each selected contact with these same details.
          </div>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Assigned to</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">— none —</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
                <option value="team">Team (everyone)</option>
                {pairOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {Object.values(TaskPriority).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {Object.values(TaskStatus).map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-foot">
          <span />
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Creating…" : `Create ${contactCount} task${contactCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
