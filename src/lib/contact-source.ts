import { Contact } from "@prisma/client";

/**
 * Contact has no explicit "sources" field the way Company does — this infers
 * a set of display labels from the same breadcrumbs the rest of the app
 * already relies on (agoraRaw presence, the import tags Agora imports/tag-sync
 * leave behind). Used in the duplicate-review queue so two candidates being
 * compared show where each one actually came from, not just their fields.
 */
export function contactSourceLabels(contact: Pick<Contact, "agoraRaw" | "tags">): string[] {
  const labels: string[] = [];
  if (contact.agoraRaw != null) labels.push("Agora");
  if (contact.tags.some((t) => /capital partner outreach import/i.test(t))) labels.push("Capital Partner Outreach");
  if (contact.tags.some((t) => /aref i active prospects import/i.test(t) || /^aref i status:/i.test(t))) {
    labels.push("AREF I Tracker");
  }
  return Array.from(new Set(labels));
}
