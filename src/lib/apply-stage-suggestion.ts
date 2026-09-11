import { prisma } from "@/lib/prisma";
import { recordStageChange } from "@/lib/stage-history";
import { validateStatusNoteRule } from "@/lib/contact-schema";
import { Correspondence, FundraisingStage, StageChangeSource } from "@prisma/client";

/**
 * Applies a stage change from a correspondence's suggestion to whichever
 * record it's linked to (contact, consultant, or capital source), and marks
 * the correspondence CONFIRMED. Shared by the human "confirm this suggestion"
 * action and the auto-apply path (Settings > Auto-apply AI stage
 * suggestions) — the only difference between them is who/what triggered it,
 * captured in `changedByName` and `source`.
 */
export async function applyStageSuggestion(params: {
  correspondence: Correspondence;
  status: FundraisingStage;
  changedByName?: string | null;
  source: StageChangeSource;
  note?: string;
}): Promise<{ error: string } | { ok: true }> {
  const { correspondence, status, changedByName, source } = params;
  const note = params.note || correspondence.suggestionRationale || "Confirmed from AI-suggested correspondence.";

  if (correspondence.contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: correspondence.contactId } });
    if (!contact) return { error: "Contact not found." };

    const noteError = validateStatusNoteRule({ previousStatus: contact.status, nextStatus: status, notes: note });
    if (noteError) return { error: noteError };

    await prisma.contact.update({ where: { id: contact.id }, data: { status, notes: note } });
    await recordStageChange({
      contactId: contact.id,
      fromStatus: contact.status,
      toStatus: status,
      note,
      changedByName: changedByName ?? null,
      source,
    });
  } else if (correspondence.consultantId) {
    const consultant = await prisma.consultant.findUnique({ where: { id: correspondence.consultantId } });
    if (!consultant) return { error: "Consultant not found." };
    await prisma.consultant.update({ where: { id: consultant.id }, data: { outreachStatus: status } });
  } else if (correspondence.capitalSourceId) {
    const capitalSource = await prisma.capitalSource.findUnique({ where: { id: correspondence.capitalSourceId } });
    if (!capitalSource) return { error: "Capital source not found." };
    await prisma.capitalSource.update({ where: { id: capitalSource.id }, data: { outreachStatus: status } });
  } else {
    return { error: "Correspondence isn't linked to a contact, consultant, or capital source." };
  }

  return { ok: true };
}
