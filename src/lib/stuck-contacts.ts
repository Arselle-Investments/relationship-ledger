import { prisma } from "@/lib/prisma";
import { ContactStatus } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

const TERMINAL_STATUSES: ContactStatus[] = [ContactStatus.COMMITTED, ContactStatus.PASSED];

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / 86_400_000);
}

export type StuckContact = ContactWithRelations & { daysInStage: number; enteredStageAt: string };

/**
 * Contacts whose current stage hasn't changed in at least `thresholdDays`.
 * "Entered this stage" is the most recent stage-history row for the contact,
 * or its createdAt if it has none (e.g. created before Phase 7 shipped, or
 * never left Not Started).
 */
export async function getStuckContacts(thresholdDays: number, today: Date = new Date()): Promise<StuckContact[]> {
  const contacts = await prisma.contact.findMany({
    where: { status: { notIn: TERMINAL_STATUSES } },
    include: { owner: true, warmPath: true },
  });
  if (contacts.length === 0) return [];

  const latestChanges = await prisma.contactStatusChange.findMany({
    where: { contactId: { in: contacts.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
  });
  const latestByContact = new Map<string, Date>();
  for (const change of latestChanges) {
    if (!latestByContact.has(change.contactId)) latestByContact.set(change.contactId, change.createdAt);
  }

  return contacts
    .map((c) => {
      const enteredStageAt = latestByContact.get(c.id) ?? c.createdAt;
      return { ...c, daysInStage: daysBetween(enteredStageAt, today), enteredStageAt: enteredStageAt.toISOString() };
    })
    .filter((c) => c.daysInStage >= thresholdDays)
    .sort((a, b) => b.daysInStage - a.daysInStage);
}
