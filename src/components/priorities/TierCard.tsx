"use client";

import { useDraggable } from "@dnd-kit/core";

export function TierCard({
  dragId,
  canEdit,
  onClick,
  title,
  subtitle,
  badge,
}: {
  dragId: string;
  canEdit: boolean;
  onClick?: () => void;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    disabled: !canEdit,
  });

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`task-card ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
    >
      <div className="t">{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{subtitle}</div>}
      {badge && (
        <div style={{ marginTop: 4 }}>
          <span className="tag brass">{badge}</span>
        </div>
      )}
    </div>
  );
}
