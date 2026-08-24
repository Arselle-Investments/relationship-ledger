import { prisma } from "@/lib/prisma";
import { ContactStatus, StageChangeSource } from "@prisma/client";

export async function recordStageChange(params: {
  contactId: string;
  fromStatus: ContactStatus | null;
  toStatus: ContactStatus;
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
