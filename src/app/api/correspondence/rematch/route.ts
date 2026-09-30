import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { findContactByNameFallback, findContactBySubjectFallback } from "@/lib/contact-match";
import { findEmergingManagerMatch } from "@/lib/em-match";
import { CorrespondenceStatus } from "@prisma/client";

/**
 * Re-runs the exact same matching tiers used at message ingestion (email →
 * name fallback → subject fallback → Emerging Managers) against every
 * still-"SUGGESTED" correspondence row, but against the *current* Contact
 * table — for catching up a backlog of suggestions that went stale after a
 * round of contact cleanup (merges, renames, new contacts added since the
 * message first came in). Deliberately reuses the same confidence tiers as
 * ingestion rather than a looser fuzzy match: a suggestion that still can't
 * resolve here is left alone for a human to link by hand, not guessed at.
 */
export async function POST() {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const pending = await prisma.correspondence.findMany({
    where: { status: CorrespondenceStatus.SUGGESTED },
    select: { id: true, subject: true, extractedName: true, extractedEmail: true, extractedOrg: true },
  });

  const matchedIds: string[] = [];
  for (const item of pending) {
    let contactId: string | null = null;
    if (item.extractedEmail) {
      const match = await prisma.contact.findFirst({
        where: { email: { equals: item.extractedEmail, mode: "insensitive" } },
      });
      if (match) contactId = match.id;
    }
    if (!contactId && item.extractedName) {
      contactId = await findContactByNameFallback(item.extractedName);
    }
    if (!contactId) {
      contactId = await findContactBySubjectFallback(item.subject);
    }

    let consultantId: string | null = null;
    let capitalSourceId: string | null = null;
    if (!contactId) {
      const emMatch = await findEmergingManagerMatch(item.extractedOrg, item.subject);
      if (emMatch && "consultantId" in emMatch) consultantId = emMatch.consultantId;
      else if (emMatch && "capitalSourceId" in emMatch) capitalSourceId = emMatch.capitalSourceId;
    }

    const matchedId = contactId || consultantId || capitalSourceId;
    if (matchedId) {
      await prisma.correspondence.update({
        where: { id: item.id },
        data: { contactId, consultantId, capitalSourceId, status: CorrespondenceStatus.MATCHED },
      });
      matchedIds.push(item.id);
    }
  }

  return NextResponse.json({
    checked: pending.length,
    newlyMatched: matchedIds.length,
    stillSuggested: pending.length - matchedIds.length,
    matchedIds,
  });
}
