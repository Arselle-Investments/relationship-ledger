"use client";

import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Contact, TaskPriority, User } from "@prisma/client";
import { TASK_TEAM_EMAILS } from "@/lib/task-constants";
import { quarterBounds } from "@/lib/conferences";
import { TaskWithRelations } from "@/types/task";
import { PriorityColumn } from "./PriorityColumn";
import { TaskModal } from "./TaskModal";
import { TasksCalendar } from "./TasksCalendar";

const PRIORITY_COLUMNS: TaskPriority[] = [TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
const DATE_RANGE_OPTIONS = [
  { value: "", label: "Any due date" },
  { value: "2w", label: "Next 2 weeks" },
  { value: "30d", label: "Next 30 days" },
  { value: "quarter", label: "This quarter" },
] as const;
type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]["value"];

function byDueDateAsc(a: TaskWithRelations, b: TaskWithRelations) {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

function dateRangeEnd(range: DateRangeValue, today: Date): string | null {
  if (!range) return null;
  if (range === "2w") {
    const d = new Date(today);
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }
  if (range === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }
  return quarterBounds(0).end;
}

export function TasksClient({
  initialTasks,
  team,
  contacts,
  canEdit,
  currentUserId,
  currentUserName,
}: {
  initialTasks: TaskWithRelations[];
  team: User[];
  contacts: Contact[];
  canEdit: boolean;
  currentUserId: string;
  currentUserName: string | null;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeValue>("");
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  // Defaults to "view" deliberately — a board full of drag targets invites
  // an accidental reprioritization; switching to "Edit" is one click, but
  // it has to be a deliberate one.
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<TaskWithRelations | null | "new">(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Only the people who actually execute tasks are assignable — everyone
  // else on the User table (an account owner, other staff not doing hands-on
  // outreach) doesn't show up here, and "Team" means this trio, not literally
  // every user in the system.
  const taskTeam = useMemo(
    () => team.filter((u) => TASK_TEAM_EMAILS.includes(u.email.toLowerCase())),
    [team]
  );

  function isAssignedToMe(task: TaskWithRelations): boolean {
    if (task.ownerId === currentUserId) return true;
    if (currentUserName && task.assigneeLabel) return task.assigneeLabel.includes(currentUserName);
    return false;
  }

  const assigneeLabels = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assigneeLabel).filter((l): l is string => !!l))).sort(),
    [tasks]
  );

  const filtered = useMemo(() => {
    let list = tasks;
    if (ownerFilter) {
      list = ownerFilter.startsWith("label:")
        ? list.filter((t) => t.assigneeLabel === ownerFilter.slice("label:".length))
        : list.filter((t) => t.ownerId === ownerFilter);
    }
    if (dateRangeFilter) {
      // A literal window, not "everything overdue plus this window" — with
      // most of this data skewing overdue already, that carve-out would
      // make the filter show almost everything and defeat its own purpose.
      const today = new Date().toISOString().slice(0, 10);
      const end = dateRangeEnd(dateRangeFilter, new Date());
      list = list.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate).toISOString().slice(0, 10);
        return due >= today && due <= (end as string);
      });
    }
    return list;
  }, [tasks, ownerFilter, dateRangeFilter]);

  // Done tasks are archived out of the active board — they're still on file
  // (and still counted, exportable, and searchable in the calendar) but
  // don't clutter the view the team actually works from day to day.
  const activeTasks = useMemo(() => filtered.filter((t) => t.status !== "DONE"), [filtered]);
  const doneTasks = useMemo(
    () => filtered.filter((t) => t.status === "DONE").sort((a, b) => b.updatedAt.valueOf() - a.updatedAt.valueOf()),
    [filtered]
  );

  const byPriority = useMemo(() => {
    const map = new Map<TaskPriority, TaskWithRelations[]>();
    for (const pr of PRIORITY_COLUMNS) map.set(pr, []);
    for (const t of activeTasks) map.get(t.priority)?.push(t);
    for (const pr of PRIORITY_COLUMNS) map.get(pr)?.sort(byDueDateAsc);
    return map;
  }, [activeTasks]);

  function upsertLocal(task: TaskWithRelations) {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      return exists ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev];
    });
    setEditing(null);
  }

  function removeLocal(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setEditing(null);
  }

  async function patchTask(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.task as TaskWithRelations;
  }

  async function handleMarkDone(task: TaskWithRelations) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "DONE" } : t)));
    const updated = await patchTask(task.id, { status: "DONE" });
    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newPriority = over.id as TaskPriority;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.priority === newPriority) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t)));
    const updated = await patchTask(taskId, { priority: newPriority });
    if (!updated) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, priority: task.priority } : t)));
    }
  }

  const canEditNow = canEdit && mode === "edit";

  return (
    <div>
      <div className="toolbar">
        <div className="view-toggle">
          <button className={viewMode === "board" ? "active" : ""} onClick={() => setViewMode("board")}>
            Board
          </button>
          <button className={viewMode === "calendar" ? "active" : ""} onClick={() => setViewMode("calendar")}>
            Calendar
          </button>
        </div>
        {canEdit && (
          <div className="view-toggle" title="Edit mode is required to drag cards between priorities or mark a task done">
            <button className={mode === "view" ? "active" : ""} onClick={() => setMode("view")}>
              View
            </button>
            <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>
              Edit
            </button>
          </div>
        )}
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
          {assigneeLabels.map((label) => (
            <option key={label} value={`label:${label}`}>
              {label}
            </option>
          ))}
        </select>
        <select value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value as DateRangeValue)}>
          {DATE_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <a className="btn" href={`/api/tasks/export${ownerFilter ? `?ownerId=${ownerFilter}` : ""}`}>
          Export to Excel
        </a>
        {canEdit && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            Add task
          </button>
        )}
      </div>

      {!canEditNow && canEdit && (
        <div className="helptext" style={{ marginBottom: 12 }}>
          View mode — switch to Edit to drag cards between priorities or mark a task done.
        </div>
      )}

      {viewMode === "board" ? (
        <>
          <DndContext id="tasks-priority-board" sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="tier-board">
              {PRIORITY_COLUMNS.map((priority) => (
                <PriorityColumn
                  key={priority}
                  priority={priority}
                  tasks={byPriority.get(priority) ?? []}
                  canEdit={canEditNow}
                  onCardClick={setEditing}
                  onMarkDone={handleMarkDone}
                  canMarkDone={isAssignedToMe}
                />
              ))}
            </div>
          </DndContext>

          <div style={{ marginTop: 24 }}>
            <button className="btn small ghost" onClick={() => setShowDone((v) => !v)}>
              {showDone ? "Hide" : "Show"} done ({doneTasks.length})
            </button>
            {showDone && (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned to</th>
                    <th>Contact</th>
                    <th>Due date</th>
                  </tr>
                </thead>
                <tbody>
                  {doneTasks.map((t) => (
                    <tr key={t.id} onClick={() => setEditing(t)}>
                      <td className="name-cell">{t.title}</td>
                      <td className="muted">{t.assigneeLabel || t.owner?.name || "—"}</td>
                      <td className="muted">{t.contact?.name || "—"}</td>
                      <td className="muted">{t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <TasksCalendar tasks={filtered} onTaskClick={setEditing} />
      )}

      {editing !== null && (
        <TaskModal
          task={editing === "new" ? null : editing}
          team={taskTeam}
          contacts={contacts}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
        />
      )}
    </div>
  );
}
