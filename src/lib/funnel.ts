import { FundraisingStage } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

// The fundraising pipeline order shown in Pipeline -> Funnel. Both PASSED
// variants are terminal drop-offs, not forward stages, but still worth
// showing so the team can see how much falls out, and where.
export const FUNDRAISING_STAGES: FundraisingStage[] = [
  FundraisingStage.NOT_STARTED,
  FundraisingStage.OUTREACH_SENT,
  FundraisingStage.INITIAL_INTEREST,
  FundraisingStage.MEETING_OCCURRED,
  FundraisingStage.FOLLOW_UP_ENGAGEMENT,
  FundraisingStage.DUE_DILIGENCE,
  FundraisingStage.COMMITTED,
  FundraisingStage.PASSED_OPEN,
  FundraisingStage.PASSED_NOT_INTERESTED,
];

// Heatmap colors for the funnel bars: a light-to-dark forest-green ramp for
// forward progress (culminating in the deepest green at Committed, reusing
// --forest's existing "good/success" meaning elsewhere in the app), then two
// deliberately different colors for the two passed stages — a neutral tan
// for "still worth another deal" versus rust for a genuine no.
export const FUNDRAISING_STAGE_COLORS: Record<FundraisingStage, string> = {
  NOT_STARTED: "#EEF2F1",
  OUTREACH_SENT: "#D7E3E1",
  INITIAL_INTEREST: "#BCD0CC",
  MEETING_OCCURRED: "#9CB9B3",
  FOLLOW_UP_ENGAGEMENT: "#7C9992",
  DUE_DILIGENCE: "#5B8079",
  COMMITTED: "#3D615A",
  PASSED_OPEN: "#C7BFAE",
  PASSED_NOT_INTERESTED: "#A85A40",
};

// Stages dark enough to need white text instead of ink.
const DARK_STAGES = new Set<FundraisingStage>([
  FundraisingStage.DUE_DILIGENCE,
  FundraisingStage.COMMITTED,
  FundraisingStage.PASSED_NOT_INTERESTED,
]);

export function fundraisingStageTextColor(status: FundraisingStage): string {
  return DARK_STAGES.has(status) ? "#FFFFFF" : "var(--ink)";
}

export function buildFunnelCounts(contacts: ContactWithRelations[]): { status: FundraisingStage; count: number }[] {
  return FUNDRAISING_STAGES.map((status) => ({
    status,
    count: contacts.filter((c) => c.status === status).length,
  }));
}

/**
 * Same stage ordering/colors as the fundraising funnel above, generalized to
 * anything with an outreachStatus (CapitalSource, Consultant) — Emerging
 * Managers outreach adopted the same FundraisingStage vocabulary once it
 * started getting real correspondence and stage tracking of its own.
 */
export function buildStatusFunnelCounts<T extends { outreachStatus: FundraisingStage }>(
  items: T[]
): { status: FundraisingStage; count: number }[] {
  return FUNDRAISING_STAGES.map((status) => ({
    status,
    count: items.filter((item) => item.outreachStatus === status).length,
  }));
}
