import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { recordStageChange } from "@/lib/stage-history";
import { validateStatusNoteRule } from "@/lib/contact-schema";
import { SuggestionState, StageChangeSource } from "@prisma/client";

/** Applies an AI-suggested stage change: a human is explicitly confirming it, so this is where the contact's status actually changes. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const correspondence = await prisma.correspondence.findUnique({ where: { id } });
  if (!correspondence) return NextResponse.json({ error: "Correspondence not found." }, { status: 404 });
  if (correspondence.suggestionState !== SuggestionState.PENDING || !correspondence.suggestedStatus || !correspondence.contactId) {
    return NextResponse.json({ error: "No pending suggestion on this correspondence." }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: correspondence.contactId } });
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const note = correspondence.suggestionRationale || "Confirmed from AI-suggested correspondence.";
  const noteError = validateStatusNoteRule({
    previousStatus: contact.status,
    nextStatus: correspondence.suggestedStatus,
    notes: note,
  });
  if (noteError) return NextResponse.json({ error: noteError }, { status: 400 });

  await prisma.contact.update({ where: { id: contact.id }, data: { status: correspondence.suggestedStatus, notes: note } });
  await recordStageChange({
    contactId: contact.id,
    fromStatus: contact.status,
    toStatus: correspondence.suggestedStatus,
    note,
    changedByName: actingUser.name,
    source: StageChangeSource.AI_SUGGESTED,
  });
  const updated = await prisma.correspondence.update({
    where: { id },
    data: { suggestionState: SuggestionState.CONFIRMED },
  });

  return NextResponse.json({ correspondence: updated });
}
