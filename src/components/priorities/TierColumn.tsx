"use client";

import { useDroppable } from "@dnd-kit/core";
import { ContactTier } from "@prisma/client";
import { CONTACT_TIER_LABELS } from "@/lib/contact-constants";

export function TierColumn({
  dropId,
  tier,
  children,
  count,
  itemLabel,
}: {
  dropId: string;
  tier: ContactTier;
  children: React.ReactNode;
  count: number;
  itemLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <div ref={setNodeRef} className={`board-col ${isOver ? "drag-over" : ""}`}>
      <h3 className="tier-col-head">
        <span className="tier-col-title">{CONTACT_TIER_LABELS[tier]}</span>
        <span className="tier-col-count">
          {count} {itemLabel}
        </span>
      </h3>
      {children}
    </div>
  );
}
