import { MailingList } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeListContacts } from "@/lib/mailing-lists";
import { logEdit } from "@/lib/edit-log";

/**
 * Agora has no concept of this CRM's mailing lists — the only channel it
 * reads is a contact's own Tags column (that's how every pre-existing
 * "mailing list" shows up in Agora's raw export today, e.g. "Target Company -
 * Tracking List"). So a CRM-created list only becomes visible to Agora by
 * adding a tag matching the list's name to each member contact, which then
 * flows out through the existing contact export/change-export routes.
 *
 * Only ever adds the tag — never removes it from a contact that's since left
 * the list, since a past inclusion in a mailing list is still true history
 * worth keeping visible in Agora, and silently untagging risks looking like
 * data loss to whoever's watching the Agora side.
 */
export async function tagContactsForList(
  list: Pick<MailingList, "id" | "name" | "mode" | "contactIds" | "filterType" | "filterTier" | "filterOwnerId" | "filterTag" | "filterStatus">,
  actingUser: { id: string; name?: string | null }
): Promise<{ tagged: number; alreadyTagged: number }> {
  const contacts = await computeListContacts(list as MailingList);
  let tagged = 0;
  let alreadyTagged = 0;
  for (const contact of contacts) {
    if (contact.tags.includes(list.name)) {
      alreadyTagged++;
      continue;
    }
    const nextTags = [...contact.tags, list.name];
    const updated = await prisma.contact.update({ where: { id: contact.id }, data: { tags: nextTags } });
    await logEdit({
      entityType: "Contact",
      entityId: contact.id,
      entityLabel: updated.name,
      changedById: actingUser.id,
      changedByName: actingUser.name,
      changes: [{ field: "tags", oldValue: contact.tags, newValue: nextTags }],
    });
    tagged++;
  }
  return { tagged, alreadyTagged };
}
