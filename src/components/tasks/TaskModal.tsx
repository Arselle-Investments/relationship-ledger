"use client";

import { useState } from "react";
import { Contact, TaskPriority, TaskStatus, User } from "@prisma/client";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/task-constants";
import { TaskWithRelations } from "@/types/task";

export function TaskModal({
  task,
  team,
  contacts,
  canEdit,
  onClose,
  onSaved,
  onDeleted,
}: {
  task: TaskWithRelations | null;
  team: User[];
  contacts: Contact[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (task: TaskWithRelations) => void;
  onDeleted: (id: string) => void;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [contactId, setContactId] = useState(task?.contactId ?? "");
  // The "assigned to" select doubles as an owner picker and a joint-assignee
  // picker: a plain team member's id, or a synthetic "pair:idA,idB" / "team"
  // value that resolves to a human-readable assigneeLabel instead of a
  // single ownerId — there's no one accountable owner for a shared task.
  const pairOptions = team.flatMap((a, i) =>
    team.slice(i + 1).map((b) => ({ value: `pair:${a.id},${b.id}`, label: `${a.name || a.email} or ${b.name || b.email}` }))
  );
  const initialAssignee = task?.assigneeLabel
    ? pairOptions.find((p) => p.label === task.assigneeLabel)?.value ?? (task.assigneeLabel === "Team" ? "team" : "")
    : task?.ownerId ?? "";
  const [assignee, setAssignee] = useState(initialAssignee);
  const [dueDate, setDueDate] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? TaskStatus.OPEN);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? TaskPriority.MEDIUM);
  const [notes, setNotes] = useState(task?.notes ?? "");
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
    const payload = {
      title: title.trim(),
      contactId: contactId || null,
      ownerId,
      assigneeLabel,
      dueDate: dueDate || null,
      status,
      priority,
      notes,
    };
    const res = await fetch(isEdit ? `/api/tasks/${task!.id}` : "/api/tasks", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onSaved(json.task);
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(task.id);
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "Edit task" : "Add task"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {!canEdit && (
            <div className="locked-msg" style={{ display: "block" }}>
              View-only — you can browse this task but not change it.
            </div>
          )}
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Related contact</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!canEdit}>
                <option value="">— none —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Assigned to</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canEdit}>
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
          </div>
          <div className="field-row">
            <div className="field">
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} disabled={!canEdit}>
                {Object.values(TaskPriority).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={!canEdit}>
              {Object.values(TaskStatus).map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        {canEdit && (
          <div className="modal-foot">
            {isEdit ? (
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            ) : (
              <span />
            )}
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
