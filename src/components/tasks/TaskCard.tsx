"use client";

import { useDraggable } from "@dnd-kit/core";
import { User } from "@prisma/client";
import { TaskWithRelations } from "@/types/task";
import { formatAssignees } from "@/lib/task-constants";

export function TaskCard({
  task,
  team,
  canEdit,
  onClick,
  onMarkDone,
}: {
  task: TaskWithRelations;
  team: User[];
  canEdit: boolean;
  onClick: () => void;
  onMarkDone?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canEdit,
  });

  const isOverdue =
    task.status !== "DONE" && task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
  const priorityClass = task.priority === "HIGH" ? "High" : task.priority === "LOW" ? "Low" : "Medium";

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`task-card pri-${priorityClass} ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
    >
      <div className="t">
        {task.title}
        {task.status === "IN_PROGRESS" && <span className="tag brass" style={{ marginLeft: 6 }}>In progress</span>}
      </div>
      <div className="meta">
        <span>
          <span className={`pri-dot pri-${priorityClass}`} />
          {formatAssignees(task.assigneeIds, team)}
        </span>
        <span className={isOverdue ? "overdue-text" : undefined}>
          {task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
        </span>
      </div>
      {task.contact && (
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          {task.contact.name}
        </div>
      )}
      {canEdit && onMarkDone && (
        <button
          type="button"
          className="btn small"
          style={{ marginTop: 8 }}
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone();
          }}
        >
          Mark done
        </button>
      )}
    </div>
  );
}
