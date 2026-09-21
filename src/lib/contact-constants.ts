import { ContactTier, ContactType, FundraisingStage } from "@prisma/client";

// Labels match the reference prototype (docs/arselle-crm.html) verbatim —
// that file is the source of truth for exact wording shown in the UI.

// Labels here are Arselle's curated subset of Agora's own "Type" picklist,
// spelled to match Agora's exact wording (not a paraphrase) so the field
// round-trips cleanly on import/export — see the ContactType enum comment in
// schema.prisma, AGORA_ARCHIVED_CONTACT_TYPES below, and the full definitions
// guide at docs/contact-company-types.md (what each value actually means and
// why, for anyone classifying a contact/company). A handful of values whose
// meaning isn't self-evident from the Agora wording alone, refined 2026-09-17:
//   - ADVISOR: a THIRD-PARTY INSTITUTIONAL investment consultant/OCIO advising
//     other institutions (e.g. Townsend, Cambridge Associates, StepStone) —
//     not an individual's personal wealth advisor, see WEALTH_MANAGER.
//   - WEALTH_MANAGER: a firm managing money for individuals/HNW households,
//     including any RIA (Registered Investment Advisor) — RIA is a
//     regulatory registration, not its own category here.
//   - HNW: a high-net-worth INDIVIDUAL who is an actual fundraising prospect
//     for Arselle's own funds — not just any wealthy person we happen to know.
//   - INDIVIDUAL: a personal-network contact we track for relationship
//     reasons, who is NOT (yet, or ever) a fundraising prospect themselves.
//   - SINGLE_FAMILY_OFFICE / MULTI_FAMILY_OFFICE: there is deliberately no
//     generic "Family Office" fallback — every family office must be
//     classified as one or the other, even when that takes manual research.
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  PLACEMENT_AGENT: "Placement Agent",
  OTHER: "Other",
  PUBLIC_PENSION_PLAN: "Public Pension Plan",
  PRIVATE_PENSION_PLAN: "Private Pension Plan",
  INSTITUTIONAL_INVESTOR: "Institutional Investor",
  ENDOWMENT: "Endowment",
  FOUNDATION: "Foundation",
  INSURANCE_COMPANY: "Insurance Company",
  SOVEREIGN_WEALTH_FUND: "Sovereign Wealth Fund",
  SINGLE_FAMILY_OFFICE: "Single Family Office",
  MULTI_FAMILY_OFFICE: "Multi Family Office",
  WEALTH_MANAGER: "Wealth Manager",
  HNW: "HNW",
  INDIVIDUAL: "Individual",
  FAMILY_MEMBER: "Family Member",
  TRUSTS_TRUSTEE: "Trusts/Trustee",
  PRIVATE_EQUITY_FUND: "Private Equity Fund",
  FUND_OF_FUNDS: "Fund of Funds",
  HEDGE_FUND: "Hedge Fund",
  ADVISOR: "Advisor",
  LAWYER: "Lawyer",
  SERVICE_PROVIDER: "Service Provider",
};

// The full picklist Agora itself offers for "Type," for reference only — most
// of these are deliberately NOT part of ContactType above and can't be
// selected anywhere in this app. Kept here (not just dropped) so a future
// developer knows these were considered and excluded on purpose, not missed.
// See docs/contact-company-types.md for the full reasoning behind each group.
export const AGORA_ARCHIVED_CONTACT_TYPES = {
  // Australian-market compliance/regulatory terms (ASIC = Australia's
  // securities regulator) — not relevant to a US-based CRE fund.
  auRegulatory: [
    "Listed Companies or domestic regulated companies",
    "Unlisted companies (registered with ASIC)",
    "Unlisted companies (unregistered with ASIC)",
    "Self-Manager Super Fund",
  ],
  // Generic personal/internal-CRM relationship categories Agora supports for
  // other client types — not capital-source classifications.
  personalRelationship: [
    "Accountant",
    "Activist",
    "Agent",
    "Colleague",
    "Developer",
    "HR",
    "Partner",
    "Recruiter",
    "Sole trader",
    "Spouse",
    "University",
    "Unaccredited Investor",
  ],
  // Too granular for how Arselle actually tracks things, or redundant with a
  // broader category already in ContactType, or redundant with the
  // Fund/Deal `status` pipeline field rather than describing entity type.
  tooGranularOrRedundant: [
    "GP Fund", // folds into PRIVATE_EQUITY_FUND on import
    "LP Fund", // folds into PRIVATE_EQUITY_FUND on import
    "CRE Sponsor",
    "Platform",
    "Other Institution", // folds into INSTITUTIONAL_INVESTOR
    "Unit Trust",
    "Wealth Fund",
    "Prospect", // pipeline stage, not entity type — see FundraisingStage
    "Potential Investor", // same
    "Investor", // Agora's own ~87%-of-records catch-all; no real signal
  ],
  // Retired 2026-09-17 in favor of always requiring more specificity —
  // "Family Office" alone was too ambiguous once we started tracking
  // single- vs. multi-family offices as genuinely different relationships.
  requiresMoreSpecificity: [
    "Family Office", // no signal on its own — must become SINGLE_FAMILY_OFFICE or MULTI_FAMILY_OFFICE (best-guess default, then manually confirmed)
    "Family Office/RIA", // folds into WEALTH_MANAGER on import
  ],
} as const;

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
  OUTREACH_SENT: "1. Outreach sent",
  INITIAL_INTEREST: "2. Initial interest",
  MEETING_OCCURRED: "3. Meeting occurred",
  ACTIVE_PROSPECT: "4a. Active prospect",
  FINAL_CLOSE_POTENTIAL: "4b. Final close potential",
  DUE_DILIGENCE: "5. Due Diligence / Dataroom",
  COMMITTED: "6. Committed",
  PASSED_OPEN: "Fund II Prospect",
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
  PASSED_OPEN: "Fund II Prospect",
  PASSED_NOT_INTERESTED: "Passed (no interest)",
};

export const ACTIVE_OUTREACH_STAGES: FundraisingStage[] = [FundraisingStage.OUTREACH_SENT];

// Merges Settings.funnelStageLabels (team-chosen renames, edited from
// Settings > Funnel stages) onto the built-in defaults — an override is only
// used where it's a non-empty string, so clearing a row's input in the
// Settings UI falls back to the default rather than showing a blank label.
export function mergeStageLabels(
  overrides: Partial<Record<FundraisingStage, string>> | null | undefined
): Record<FundraisingStage, string> {
  if (!overrides) return FUNDRAISING_STAGE_LABELS;
  const merged = { ...FUNDRAISING_STAGE_LABELS };
  for (const key of Object.keys(overrides) as FundraisingStage[]) {
    const value = overrides[key];
    if (value && value.trim()) merged[key] = value.trim();
  }
  return merged;
}

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
