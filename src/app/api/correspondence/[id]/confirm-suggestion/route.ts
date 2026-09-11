import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { applyStageSuggestion } from "@/lib/apply-stage-suggestion";
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
  const note =
    overrideStatus && overrideStatus !== correspondence.suggestedStatus
      ? `Set to ${FUNDRAISING_STAGE_LABELS[overrideStatus]} when reviewing this correspondence (AI had suggested ${FUNDRAISING_STAGE_LABELS[correspondence.suggestedStatus!]}). ${correspondence.suggestionRationale ?? ""}`.trim()
      : undefined;

  const result = await applyStageSuggestion({
    correspondence,
    status: nextStatus,
    changedByName: actingUser.name,
    source: StageChangeSource.AI_SUGGESTED,
    note,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const updated = await prisma.correspondence.update({
    where: { id },
    data: { suggestionState: SuggestionState.CONFIRMED },
  });

  return NextResponse.json({ correspondence: updated });
}
