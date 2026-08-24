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
  const signal = await classifyStageSignal({
    currentStatus: contact.status,
    recentHistory,
    subject: params.subject,
    bodyText: params.bodyText,
  });

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
