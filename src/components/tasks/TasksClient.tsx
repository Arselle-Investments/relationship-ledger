"use client";

import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Contact, TaskStatus, User } from "@prisma/client";
import { TASK_BOARD_COLUMNS } from "@/lib/task-constants";
import { TaskWithRelations } from "@/types/task";
import { BoardColumn } from "./BoardColumn";
import { TaskModal } from "./TaskModal";

export function TasksClient({
  initialTasks,
  team,
  contacts,
  canEdit,
}: {
  initialTasks: TaskWithRelations[];
  team: User[];
  contacts: Contact[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [editing, setEditing] = useState<TaskWithRelations | null | "new">(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(
    () => (ownerFilter ? tasks.filter((t) => t.ownerId === ownerFilter) : tasks),
    [tasks, ownerFilter]
  );

  const byColumn = useMemo(() => {
    const map = new Map<TaskStatus, TaskWithRelations[]>();
    for (const status of TASK_BOARD_COLUMNS) map.set(status, []);
    for (const t of filtered) map.get(t.status)?.push(t);
    return map;
  }, [filtered]);

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      // roll back on failure
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)));
    }
  }

  return (
    <div>
      <div className="toolbar">
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div id="task-board">
          {TASK_BOARD_COLUMNS.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={byColumn.get(status) ?? []}
              canEdit={canEdit}
              onCardClick={setEditing}
            />
          ))}
        </div>
      </DndContext>

      {editing !== null && (
        <TaskModal
          task={editing === "new" ? null : editing}
          team={team}
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
