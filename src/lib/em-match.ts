import { prisma } from "@/lib/prisma";

/**
 * Matches a Teams message to an existing Consultant or CapitalSource by
 * organization name — these are institutions, not people, so this is a much
 * simpler check than the person-name fallbacks used for Contact: an exact
 * (case-insensitive) name/shortName match against the AI-extracted org, or
 * failing that, the org's name appearing as a whole word in the subject
 * line. Only auto-links when exactly one candidate matches, same safety net
 * as the Contact fallbacks.
 */
export async function findEmergingManagerMatch(
  org: string | null,
  subject: string | null
): Promise<{ consultantId: string } | { capitalSourceId: string } | null> {
  const needle = org?.trim().toLowerCase();
  if (needle) {
    const consultants = await prisma.consultant.findMany({ where: { name: { equals: needle, mode: "insensitive" } } });
    if (consultants.length === 1) return { consultantId: consultants[0].id };
    const capitalSources = await prisma.capitalSource.findMany({
      where: { OR: [{ name: { equals: needle, mode: "insensitive" } }, { shortName: { equals: needle, mode: "insensitive" } }] },
    });
    if (capitalSources.length === 1) return { capitalSourceId: capitalSources[0].id };
  }

  if (!subject?.trim()) return null;
  const [allConsultants, allCapitalSources] = await Promise.all([
    prisma.consultant.findMany({ select: { id: true, name: true } }),
    prisma.capitalSource.findMany({ select: { id: true, name: true, shortName: true } }),
  ]);

  const consultantHits = allConsultants.filter((c) => wordPresent(subject, c.name));
  const capitalSourceHits = allCapitalSources.filter(
    (c) => wordPresent(subject, c.name) || (c.shortName && wordPresent(subject, c.shortName))
  );
  const totalHits = consultantHits.length + capitalSourceHits.length;
  if (totalHits !== 1) return null; // none, or ambiguous (more than one org named) — leave for a human
  if (consultantHits.length === 1) return { consultantId: consultantHits[0].id };
  return { capitalSourceId: capitalSourceHits[0].id };
}

function wordPresent(text: string, phrase: string): boolean {
  const trimmed = phrase.trim();
  if (trimmed.length < 3) return false; // too short to safely match as a whole word (e.g. an acronym prone to false hits)
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}
