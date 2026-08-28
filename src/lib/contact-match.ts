import { prisma } from "@/lib/prisma";
import { contactMatchesName, nicknameVariants, splitName } from "@/lib/name-match";
import { DEV_TEAM } from "@/lib/dev-team";

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

const STAFF_NAMES = new Set(DEV_TEAM.map((m) => m.name.trim().toLowerCase()));

// Generic words that occasionally show up as a contact's "first name" on
// junk/placeholder rows (e.g. a literal "Test Investor" test contact) rather
// than an actual given name — matching on these would false-positive on any
// subject that happens to contain the word itself.
const NON_NAME_FIRST_WORDS = new Set([
  "test",
  "info",
  "admin",
  "investor",
  "investors",
  "team",
  "group",
  "office",
  "support",
  "sales",
  "marketing",
  "communications",
  "relations",
  "shared",
  "mailbox",
  "noreply",
]);

function wordPresent(text: string, word: string): boolean {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/**
 * Fallback for when neither the email nor the extracted name resolved a
 * contact, but the subject line names the person directly — common for a
 * forwarded introduction ("Fw: Introduction - Ron & Nurit Kotick...") or a
 * quick check-in ("Re: Raudline <> Aaron"), where the sender/recipient
 * headers only show internal team members. Prefers a contact whose full
 * name (first and last, anywhere in the subject) is present; when only a
 * first name shows up, it's used alone only if that first name is unique
 * across the whole roster — "Raudline" is safe on its own, "Aaron" isn't.
 */
export async function findContactBySubjectFallback(subject: string | null): Promise<string | null> {
  if (!subject || !subject.trim()) return null;
  const all = await prisma.contact.findMany({ select: { id: true, name: true, email: true } });

  const splitByContact = new Map<string, { first: string; last: string }>();
  const byFirstNameVariant = new Map<string, Set<string>>();
  for (const c of all) {
    if (STAFF_NAMES.has(c.name.trim().toLowerCase())) continue; // staff carried over as "contacts" from the Agora import, not real investors
    if (c.email?.toLowerCase().endsWith("@arselleinvestments.com")) continue; // our own shared mailboxes (e.g. "Investor Relations"), not an external investor
    const split = splitName(c.name);
    if (!split) continue;
    if (NON_NAME_FIRST_WORDS.has(split.first)) continue; // junk/placeholder contact (e.g. "Test Investor"), not a real person
    splitByContact.set(c.id, split);
    for (const variant of nicknameVariants(split.first)) {
      const set = byFirstNameVariant.get(variant) ?? new Set<string>();
      set.add(c.id);
      byFirstNameVariant.set(variant, set);
    }
  }

  let strongMatch: string | null = null;
  for (const [id, split] of splitByContact) {
    const firstPresent = nicknameVariants(split.first).some((v) => wordPresent(subject, v));
    const lastPresent = wordPresent(subject, split.last);
    if (!firstPresent || !lastPresent) continue;
    if (strongMatch && strongMatch !== id) return null; // two different full names mentioned — ambiguous
    strongMatch = id;
  }
  if (strongMatch) return strongMatch;

  let weakMatch: string | null = null;
  for (const [variant, ids] of byFirstNameVariant) {
    if (ids.size !== 1 || !wordPresent(subject, variant)) continue; // first name shared by more than one contact — too risky alone
    const candidateId = [...ids][0];
    if (weakMatch && weakMatch !== candidateId) return null; // two different unique first names both mentioned — ambiguous
    weakMatch = candidateId;
  }
  return weakMatch;
}
