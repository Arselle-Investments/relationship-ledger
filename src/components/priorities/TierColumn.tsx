"use client";

import { useDroppable } from "@dnd-kit/core";
import { ContactTier } from "@prisma/client";
import { CONTACT_TIER_LABELS } from "@/lib/contact-constants";

export function TierColumn({
  dropId,
  tier,
  children,
  count,
}: {
  dropId: string;
  tier: ContactTier;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <div ref={setNodeRef} className={`board-col ${isOver ? "drag-over" : ""}`}>
      <h3>
        {CONTACT_TIER_LABELS[tier]} <span className="muted">{count}</span>
      </h3>
      {children}
    </div>
  );
}
