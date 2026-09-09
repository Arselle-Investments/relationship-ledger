"use client";

import { useDroppable } from "@dnd-kit/core";
import { TaskPriority } from "@prisma/client";
import { TASK_PRIORITY_LABELS } from "@/lib/task-constants";
import { TaskWithRelations } from "@/types/task";
import { TaskCard } from "./TaskCard";

export function PriorityColumn({
  priority,
  tasks,
  canEdit,
  onCardClick,
  onMarkDone,
}: {
  priority: TaskPriority;
  tasks: TaskWithRelations[];
  canEdit: boolean;
  onCardClick: (task: TaskWithRelations) => void;
  onMarkDone: (task: TaskWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: priority });

  return (
    <div ref={setNodeRef} className={`board-col ${isOver ? "drag-over" : ""}`}>
      <h3 className="tier-col-head">
        <span className="tier-col-title">{TASK_PRIORITY_LABELS[priority]} priority</span>
        <span className="tier-col-count">
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </h3>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} canEdit={canEdit} onClick={() => onCardClick(task)} onMarkDone={() => onMarkDone(task)} />
      ))}
    </div>
  );
}
