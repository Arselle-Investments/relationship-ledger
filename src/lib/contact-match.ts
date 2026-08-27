import { prisma } from "@/lib/prisma";
import { contactMatchesName } from "@/lib/name-match";

/**
 * Fallback for when a message's email doesn't resolve to an existing
 * contact (a personal address not on file, or extraction found no email at
 * all) but did surface a name — e.g. "Ron Weathers" should still find the
 * existing contact "Ronald Weathers". Only auto-links when exactly one
 * contact matches; more than one is left for a human to disambiguate via
 * "Link to existing contact" rather than risk linking the wrong person.
 */
export async function findContactByNameFallback(name: string | null): Promise<string | null> {
  if (!name || !name.trim()) return null;
  const candidates = await prisma.contact.findMany({ select: { id: true, name: true } });
  const matches = candidates.filter((c) => contactMatchesName(c, name));
  return matches.length === 1 ? matches[0].id : null;
}
