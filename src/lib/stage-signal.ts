import { prisma } from "@/lib/prisma";
import { classifyStageSignal } from "@/lib/ai";
import { getRecentStageHistorySummary } from "@/lib/stage-history";
import { Correspondence, SuggestionState } from "@prisma/client";

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

  return prisma.correspondence.update({
    where: { id: params.correspondenceId },
    data: {
      suggestedStatus: signal.suggestedStatus,
      suggestionRationale: signal.rationale,
      suggestionState: SuggestionState.PENDING,
    },
  });
}
