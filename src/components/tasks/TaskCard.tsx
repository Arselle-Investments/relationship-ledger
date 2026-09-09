"use client";

import { useDraggable } from "@dnd-kit/core";
import { TaskWithRelations } from "@/types/task";

export function TaskCard({
  task,
  canEdit,
  onClick,
  onMarkDone,
}: {
  task: TaskWithRelations;
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

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`task-card ${isOverdue ? "overdue" : ""} ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
    >
      <div className="t">
        {task.title}
        {task.status === "IN_PROGRESS" && <span className="tag brass" style={{ marginLeft: 6 }}>In progress</span>}
      </div>
      <div className="meta">
        <span>
          <span className={`pri-dot pri-${task.priority === "HIGH" ? "High" : task.priority === "LOW" ? "Low" : "Medium"}`} />
          {task.assigneeLabel || task.owner?.name || "Unassigned"}
        </span>
        <span>{task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}</span>
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
