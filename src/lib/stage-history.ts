import { prisma } from "@/lib/prisma";
import { FundraisingStage, StageChangeSource } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

export async function recordStageChange(params: {
  contactId: string;
  fromStatus: FundraisingStage | null;
  toStatus: FundraisingStage;
  note: string;
  changedByName?: string | null;
  source?: StageChangeSource;
}) {
  return prisma.contactStatusChange.create({
    data: {
      contactId: params.contactId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      note: params.note,
      changedByName: params.changedByName || null,
      source: params.source ?? StageChangeSource.MANUAL,
    },
  });
}

/** Short plain-text summary of a contact's last few stage changes, for feeding to the AI classifier. */
export async function getRecentStageHistorySummary(contactId: string, limit = 3): Promise<string> {
  const changes = await prisma.contactStatusChange.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  if (changes.length === 0) return "";
  return changes
    .map((c) => `moved to ${FUNDRAISING_STAGE_LABELS[c.toStatus]} on ${c.createdAt.toISOString().slice(0, 10)}`)
    .join("; ");
}
