import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { recordStageChange } from "@/lib/stage-history";
import { validateStatusNoteRule } from "@/lib/contact-schema";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { FundraisingStage, SuggestionState, StageChangeSource } from "@prisma/client";

/**
 * Applies a stage change from a pending suggestion: a human is explicitly
 * confirming it, so this is where the linked record's status actually
 * changes. Handles all three things correspondence can be matched to —
 * contact, consultant, or capital source — since Emerging Managers shares
 * the same FundraisingStage vocabulary as Contact. Optionally takes a
 * `status` in the body to override the AI's suggested stage with a
 * different one the reviewer picked instead.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const linkedId = correspondence.contactId || correspondence.consultantId || correspondence.capitalSourceId;
  if (correspondence.suggestionState !== SuggestionState.PENDING || !correspondence.suggestedStatus || !linkedId) {
    return NextResponse.json({ error: "No pending suggestion on this correspondence." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const overrideStatus: FundraisingStage | undefined =
    body.status && Object.values(FundraisingStage).includes(body.status) ? body.status : undefined;
  const nextStatus = overrideStatus || correspondence.suggestedStatus;
  const rationaleNote = () =>
    overrideStatus && overrideStatus !== correspondence.suggestedStatus
      ? `Set to ${FUNDRAISING_STAGE_LABELS[overrideStatus]} when reviewing this correspondence (AI had suggested ${FUNDRAISING_STAGE_LABELS[correspondence.suggestedStatus!]}). ${correspondence.suggestionRationale ?? ""}`.trim()
      : correspondence.suggestionRationale || "Confirmed from AI-suggested correspondence.";

  if (correspondence.contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: correspondence.contactId } });
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    const note = rationaleNote();
    const noteError = validateStatusNoteRule({ previousStatus: contact.status, nextStatus, notes: note });
    if (noteError) return NextResponse.json({ error: noteError }, { status: 400 });

    await prisma.contact.update({ where: { id: contact.id }, data: { status: nextStatus, notes: note } });
    await recordStageChange({
      contactId: contact.id,
      fromStatus: contact.status,
      toStatus: nextStatus,
      note,
      changedByName: actingUser.name,
      source: StageChangeSource.AI_SUGGESTED,
    });
  } else if (correspondence.consultantId) {
    const consultant = await prisma.consultant.findUnique({ where: { id: correspondence.consultantId } });
    if (!consultant) return NextResponse.json({ error: "Consultant not found." }, { status: 404 });
    await prisma.consultant.update({ where: { id: consultant.id }, data: { outreachStatus: nextStatus } });
  } else if (correspondence.capitalSourceId) {
    const capitalSource = await prisma.capitalSource.findUnique({ where: { id: correspondence.capitalSourceId } });
    if (!capitalSource) return NextResponse.json({ error: "Capital source not found." }, { status: 404 });
    await prisma.capitalSource.update({ where: { id: capitalSource.id }, data: { outreachStatus: nextStatus } });
  }

  const updated = await prisma.correspondence.update({
    where: { id },
    data: { suggestionState: SuggestionState.CONFIRMED },
  });

  return NextResponse.json({ correspondence: updated });
}
