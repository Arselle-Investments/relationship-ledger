"use client";

import { useDroppable } from "@dnd-kit/core";
import { TaskStatus } from "@prisma/client";
import { TASK_STATUS_LABELS } from "@/lib/task-constants";
import { TaskWithRelations } from "@/types/task";
import { TaskCard } from "./TaskCard";

export function BoardColumn({
  status,
  tasks,
  canEdit,
  onCardClick,
}: {
  status: TaskStatus;
  tasks: TaskWithRelations[];
  canEdit: boolean;
  onCardClick: (task: TaskWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div ref={setNodeRef} className={`board-col ${isOver ? "drag-over" : ""}`}>
      <h3>
        {TASK_STATUS_LABELS[status]} <span className="muted">{tasks.length}</span>
      </h3>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} canEdit={canEdit} onClick={() => onCardClick(task)} />
      ))}
    </div>
  );
}
