import { ContactTier, ContactType, FundraisingStage } from "@prisma/client";

// Labels match the reference prototype (docs/arselle-crm.html) verbatim —
// that file is the source of truth for exact wording shown in the UI.

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  LP_INSTITUTIONAL: "LP / Institutional",
  FAMILY_OFFICE: "Family Office",
  PLACEMENT_AGENT: "Placement Agent",
  BROKER_ADVISOR: "Broker / Advisor",
  SPONSOR_COGP: "Sponsor / Co-GP",
  CONSULTANT: "Consultant",
  OTHER: "Other",
};

export const CONTACT_TIER_LABELS: Record<ContactTier, string> = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
};

// The fundraising/syndication pipeline — Contact (LP-level), DealFeedback
// (company-level), and Consultant/CapitalSource (Emerging Managers outreach),
// the same funnel just anchored at whichever level applies. This is the
// Fund Raise (Contact-level) wording specifically — Deal Capital and
// Emerging Managers each override the one label that differs by context
// (PASSED_OPEN) via FEEDBACK_STATUS_LABELS and EM_STAGE_LABELS respectively.
export const FUNDRAISING_STAGE_LABELS: Record<FundraisingStage, string> = {
  NOT_STARTED: "Not started",
  OUTREACH_SENT: "Outreach sent",
  INITIAL_INTEREST: "Initial interest",
  MEETING_OCCURRED: "Meeting occurred",
  FOLLOW_UP_ENGAGEMENT: "Follow-up engagement",
  DUE_DILIGENCE: "Due diligence / Data room",
  COMMITTED: "Committed",
  PASSED_OPEN: "Passed (open to future funds)",
  PASSED_NOT_INTERESTED: "Passed (not interested)",
  DO_NOT_CONTACT: "Do not contact",
};

// Emerging Managers (Consultant/CapitalSource.outreachStatus) — same pipeline,
// but "open" here means open to a future EM opportunity, not a future fund or deal.
export const EM_STAGE_LABELS: Record<FundraisingStage, string> = {
  ...FUNDRAISING_STAGE_LABELS,
  PASSED_OPEN: "Passed (open to future opportunities)",
};

// Short badge/tag text for the two terminal "passed" stages, used wherever
// space is tight (funnel bars, table cells) — the full label above is used
// everywhere else (dropdowns, detail views).
export const FUNDRAISING_STAGE_SHORT_LABELS: Partial<Record<FundraisingStage, string>> = {
  PASSED_OPEN: "Passed (open)",
  PASSED_NOT_INTERESTED: "Passed (no interest)",
};

export const ACTIVE_OUTREACH_STAGES: FundraisingStage[] = [FundraisingStage.OUTREACH_SENT];

function invert<T extends string>(labels: Record<T, string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key in labels) {
    out[labels[key as T].toLowerCase()] = key as T;
  }
  return out;
}

export const CONTACT_TYPE_BY_LABEL = invert(CONTACT_TYPE_LABELS);
export const CONTACT_TIER_BY_LABEL = invert(CONTACT_TIER_LABELS);
export const FUNDRAISING_STAGE_BY_LABEL = invert(FUNDRAISING_STAGE_LABELS);
