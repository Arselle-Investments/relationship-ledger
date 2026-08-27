import { prisma } from "@/lib/prisma";
import { classifyStageSignal } from "@/lib/ai";
import { getRecentStageHistorySummary } from "@/lib/stage-history";
import { Correspondence, SuggestionState } from "@prisma/client";

/**
 * Runs stage classification for one piece of correspondence already linked to
 * a contact, and records the result on it as a pending suggestion if (and
 * only if) the model found a clear signal. Never touches the contact itself —
 * that only happens once a human confirms via the stage-suggestion endpoints.
 * Returns the correspondence row as it stands after this call, so callers
 * that already have a pre-classification copy can refresh what they return.
 */
export async function maybeCreateStageSuggestion(params: {
  correspondenceId: string;
  contactId: string;
  subject: string;
  bodyText: string;
}): Promise<Correspondence | null> {
  const contact = await prisma.contact.findUnique({ where: { id: params.contactId } });
  if (!contact) return null;

  const recentHistory = await getRecentStageHistorySummary(params.contactId);
  let signal;
  try {
    signal = await classifyStageSignal({
      currentStatus: contact.status,
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
