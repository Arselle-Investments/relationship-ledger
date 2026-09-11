import { Deliverable } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

/**
 * A contact counts as having received a deliverable if any one of its
 * tagMatches shows up as a substring of one of their tags (case-insensitive)
 * — same matching rule as a Mailing List's filterTag, just OR'd across
 * several patterns, since the same real deliverable has sometimes picked up
 * more than one tag wording over time (e.g. "Hiawatha Recipient" vs.
 * "Received Hiawatha Email 2026").
 */
export function computeDeliverableContacts(
  deliverable: Pick<Deliverable, "tagMatches">,
  allContacts: ContactWithRelations[]
): ContactWithRelations[] {
  const needles = deliverable.tagMatches.map((t) => t.toLowerCase()).filter(Boolean);
  if (needles.length === 0) return [];
  return allContacts.filter((c) => c.tags.some((t) => needles.some((n) => t.toLowerCase().includes(n))));
}
