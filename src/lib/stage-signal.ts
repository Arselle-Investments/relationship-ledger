import { prisma } from "@/lib/prisma";
import { classifyStageSignal } from "@/lib/ai";
import { getRecentStageHistorySummary } from "@/lib/stage-history";
import { getSettings } from "@/lib/settings";
import { applyStageSuggestion } from "@/lib/apply-stage-suggestion";
import { Correspondence, StageChangeSource, SuggestionState } from "@prisma/client";

/**
 * Runs stage classification for one piece of correspondence already linked to
 * a contact, consultant, or capital source (exactly one of the three ids),
 * and records the result on it as a pending suggestion if (and only if) the
 * model found a clear signal. Never touches the linked record itself — that
 * only happens once a human confirms via the stage-suggestion endpoints.
 * Returns the correspondence row as it stands after this call, so callers
 * that already have a pre-classification copy can refresh what they return.
 *
 * Emerging Managers entities (consultant/capitalSource) share the same
 * FundraisingStage vocabulary as Contact, but don't yet have their own stage
 * history log, so recentHistory is only available for a contact match.
 */
export async function maybeCreateStageSuggestion(params: {
  correspondenceId: string;
  contactId?: string | null;
  consultantId?: string | null;
  capitalSourceId?: string | null;
  subject: string;
  bodyText: string;
}): Promise<Correspondence | null> {
  let currentStatus;
  let recentHistory = "";
  if (params.contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: params.contactId } });
    if (!contact) return null;
    currentStatus = contact.status;
    recentHistory = await getRecentStageHistorySummary(params.contactId);
  } else if (params.consultantId) {
    const consultant = await prisma.consultant.findUnique({ where: { id: params.consultantId } });
    if (!consultant) return null;
    currentStatus = consultant.outreachStatus;
  } else if (params.capitalSourceId) {
    const capitalSource = await prisma.capitalSource.findUnique({ where: { id: params.capitalSourceId } });
    if (!capitalSource) return null;
    currentStatus = capitalSource.outreachStatus;
  } else {
    return null;
  }

  let signal;
  try {
    signal = await classifyStageSignal({
      currentStatus,
      recentHistory,
      subject: params.subject,
      bodyText: params.bodyText,
    });
  } catch (e) {
    // Stage classification is a nice-to-have on top of a link/match that has
    // already been saved — an AI outage (rate limit, exhausted credits)
    // shouldn't take down the action that triggered it.
    console.error("Stage classification failed, skipping suggestion", e);
    return null;
  }

  if (!signal.suggestedStatus) return null;

  const correspondence = await prisma.correspondence.update({
    where: { id: params.correspondenceId },
    data: {
      suggestedStatus: signal.suggestedStatus,
      suggestionRationale: signal.rationale,
      suggestionState: SuggestionState.PENDING,
    },
  });

  const settings = await getSettings();
  if (!settings.autoApplyStageSuggestions) return correspondence;

  // Settings > Auto-apply AI stage suggestions is on — skip the human
  // confirmation step and apply it immediately. Still recorded as its own
  // StageChangeSource so the activity timeline is honest that no one actually
  // reviewed this one.
  const result = await applyStageSuggestion({
    correspondence,
    status: signal.suggestedStatus,
    changedByName: null,
    source: StageChangeSource.AI_AUTO_APPLIED,
  });
  if ("error" in result) {
    // The usual cause is validateStatusNoteRule requiring a note the AI
    // rationale didn't clear — leave it PENDING for a human instead of
    // silently dropping the suggestion.
    return correspondence;
  }

  return prisma.correspondence.update({
    where: { id: params.correspondenceId },
    data: { suggestionState: SuggestionState.CONFIRMED },
  });
}
