import { MailingList, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ContactWithRelations } from "@/types/contact";

/**
 * STATIC lists have a fixed contactIds set; DYNAMIC lists recompute their
 * membership from a saved filter every time they're viewed. Tag matching is
 * substring/case-insensitive (mirrors the reference prototype), which Prisma
 * can't express as a single array filter, so it's applied in JS after the
 * type/tier/owner filter narrows the candidate set.
 */
export async function computeListContacts(list: MailingList): Promise<ContactWithRelations[]> {
  if (list.mode === "STATIC") {
    if (list.contactIds.length === 0) return [];
    return prisma.contact.findMany({
      where: { id: { in: list.contactIds } },
      include: { owner: true, warmPath: true },
      orderBy: { name: "asc" },
    });
  }

  const where: Prisma.ContactWhereInput = {
    ...(list.filterType ? { type: list.filterType } : {}),
    ...(list.filterTier ? { tier: list.filterTier } : {}),
    ...(list.filterOwnerId ? { ownerId: list.filterOwnerId } : {}),
    ...(list.filterStatus ? { status: list.filterStatus } : {}),
  };
  const candidates = await prisma.contact.findMany({
    where,
    include: { owner: true, warmPath: true },
    orderBy: { name: "asc" },
  });
  if (!list.filterTag) return candidates;
  const needle = list.filterTag.toLowerCase();
  return candidates.filter((c) => c.tags.some((t) => t.toLowerCase().includes(needle)));
}
