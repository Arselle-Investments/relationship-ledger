import { FundraisingStage } from "@prisma/client";

// The fundraising pipeline order shown in Fund Raise -> Funnel, split into two
// visual groups. PIPELINE_STAGES is the live, forward-moving funnel — Committed
// is deliberately last, since it's the actual finish line for this raise, not
// just "the stage before the drop-off stages." DROPPED_STAGES are the
// terminal drop-offs/parking stages (a soft pass worth re-approaching for
// Fund II, a genuine no, or a firm stop) — still worth showing so the team can
// see how much falls out and where, but rendered in their own box below the
// live pipeline so Committed reads as the finish line, not just one more bar
// before the drop-offs.
export const PIPELINE_STAGES: FundraisingStage[] = [
  FundraisingStage.NOT_STARTED,
  FundraisingStage.OUTREACH_SENT,
  FundraisingStage.INITIAL_INTEREST,
  FundraisingStage.MEETING_OCCURRED,
  FundraisingStage.ACTIVE_PROSPECT,
  FundraisingStage.DUE_DILIGENCE,
  FundraisingStage.COMMITTED,
];

export const DROPPED_STAGES: FundraisingStage[] = [
  FundraisingStage.PASSED_OPEN,
  FundraisingStage.PASSED_NOT_INTERESTED,
  FundraisingStage.DO_NOT_CONTACT,
];

export const FUNDRAISING_STAGES: FundraisingStage[] = [...PIPELINE_STAGES, ...DROPPED_STAGES];

// Heatmap colors for the funnel bars: a light-to-dark forest-green ramp for
// forward progress (culminating in the deepest green at Committed, reusing
// --forest's existing "good/success" meaning elsewhere in the app), then
// progressively harder-stop colors for the drop-off outcomes — a neutral tan
// for "still worth another deal", rust for a genuine no, and a deeper
// maroon for "never reach out again."
export const FUNDRAISING_STAGE_COLORS: Record<FundraisingStage, string> = {
  NOT_STARTED: "#EEF2F1",
  OUTREACH_SENT: "#D7E3E1",
  INITIAL_INTEREST: "#BCD0CC",
  MEETING_OCCURRED: "#9CB9B3",
  // Breaks from the green progress ramp on purpose — a deliberately-targeted
  // prospect is a distinct designation, not just "one rung further along."
  ACTIVE_PROSPECT: "#C9A66B",
  DUE_DILIGENCE: "#5B8079",
  COMMITTED: "#3D615A",
  PASSED_OPEN: "#C7BFAE",
  PASSED_NOT_INTERESTED: "#A85A40",
  DO_NOT_CONTACT: "#6B2E2E",
};

// Stages dark enough to need white text instead of ink.
const DARK_STAGES = new Set<FundraisingStage>([
  FundraisingStage.DUE_DILIGENCE,
  FundraisingStage.COMMITTED,
  FundraisingStage.PASSED_NOT_INTERESTED,
  FundraisingStage.DO_NOT_CONTACT,
]);

export function fundraisingStageTextColor(status: FundraisingStage): string {
  return DARK_STAGES.has(status) ? "#FFFFFF" : "var(--ink)";
}

export function buildFunnelCounts<T extends { status: FundraisingStage }>(
  items: T[],
  stages: FundraisingStage[] = FUNDRAISING_STAGES
): { status: FundraisingStage; count: number }[] {
  return stages.map((status) => ({
    status,
    count: items.filter((c) => c.status === status).length,
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
