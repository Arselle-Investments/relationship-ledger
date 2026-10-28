import { AssetClass, DealFeedbackStage, DealStatus, InvestmentStrategy, InvestmentStructure } from "@prisma/client";

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under contract",
  DEAD: "Dead",
  DORMANT: "Dormant",
};

export const DEAL_STATUS_TAG_CLASS: Record<DealStatus, string> = {
  ACTIVE: "forest",
  UNDER_CONTRACT: "brass",
  DEAD: "",
  DORMANT: "",
};

// Same vocabulary used for Company.targetAssetClasses, so a deal's asset
// class lines up with the criteria capital partners are filtered by.
export const DEAL_ASSET_CLASS_OPTIONS = ["Industrial", "Multifamily", "Retail", "Self-Storage", "Other (Write-In)"];

// Company.targetAssetClasses/investmentStructures/investmentStrategies were
// free-text write-in fields until locked down to fixed enums on 2026-09-25
// (see docs/data-cleanup-tracker.md for the cleanup that preceded it — the
// old combined "Value-Add / Opp" write-in was split company-by-company
// first). Office/Hospitality/Land are kept despite zero current usage, per
// Bianca. These are Company-level, not Contact-level — no Agora mapping
// exists for them (Agora's template dropped the columns that used to carry
// this data, see agora-export-template.ts).
export const COMPANY_ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  INDUSTRIAL: "Industrial",
  MULTIFAMILY: "Multifamily",
  RETAIL: "Retail",
  SELF_STORAGE: "Self-Storage",
  OFFICE: "Office",
  HOSPITALITY: "Hospitality",
  LAND: "Land",
};
export const COMPANY_ASSET_CLASS_OPTIONS = Object.values(AssetClass);

export const COMPANY_INVESTMENT_STRUCTURE_LABELS: Record<InvestmentStructure, string> = {
  LP_EQUITY: "LP Equity",
  CO_GP: "Co-GP",
  STRUCTURED_EQUITY: "Structured Equity",
  DEBT_CAPITAL: "Debt Capital",
  OTHER_STRATEGIC: "Other Strategic",
};
export const COMPANY_INVESTMENT_STRUCTURE_OPTIONS = Object.values(InvestmentStructure);

export const COMPANY_INVESTMENT_STRATEGY_LABELS: Record<InvestmentStrategy, string> = {
  CORE: "Core",
  CORE_PLUS: "Core+",
  VALUE_ADD: "Value-Add",
  OPPORTUNISTIC: "Opportunistic",
  NNN: "NNN",
};
export const COMPANY_INVESTMENT_STRATEGY_OPTIONS = Object.values(InvestmentStrategy);

// Deal feedback (company/LP-level) has its own funnel, separate from the
// fund-raising FundraisingStage — a deal is socialized to a capital partner,
// not courted over years. Labels follow Bianca's numbering (Declined is 4b,
// ahead of Term Sheet / Committed at 5), and this array is the display order.
export const FEEDBACK_STAGES: DealFeedbackStage[] = [
  DealFeedbackStage.BRAINSTORM,
  DealFeedbackStage.OUTREACH_SENT,
  DealFeedbackStage.ENGAGEMENT_SHOWN,
  DealFeedbackStage.DUE_DILIGENCE,
  DealFeedbackStage.DECLINED,
  DealFeedbackStage.TERM_SHEET_COMMITTED,
];

export const FEEDBACK_STATUS_LABELS: Record<DealFeedbackStage, string> = {
  BRAINSTORM: "1. Brainstorm as Potential Fit",
  OUTREACH_SENT: "2. Outreach Sent",
  ENGAGEMENT_SHOWN: "3. Engagement Shown",
  DUE_DILIGENCE: "4a. Due Diligence",
  DECLINED: "4b. Declined",
  TERM_SHEET_COMMITTED: "5. Term Sheet / Committed",
};

export const FEEDBACK_STATUS_TAG_CLASS: Record<DealFeedbackStage, string> = {
  BRAINSTORM: "",
  OUTREACH_SENT: "",
  ENGAGEMENT_SHOWN: "brass",
  DUE_DILIGENCE: "brass",
  DECLINED: "rust",
  TERM_SHEET_COMMITTED: "forest",
};

// Funnel-bar colors: same forest-green ombre as the fund funnel (lightest at
// the start, deepest at the finish line), rust for a decline.
export const FEEDBACK_STAGE_COLORS: Record<DealFeedbackStage, string> = {
  BRAINSTORM: "#F0F5F4",
  OUTREACH_SENT: "#D4DEDC",
  ENGAGEMENT_SHOWN: "#9CB0AD",
  DUE_DILIGENCE: "#63837E",
  DECLINED: "#A85A40",
  TERM_SHEET_COMMITTED: "#2B554F",
};

const DARK_FEEDBACK_STAGES = new Set<DealFeedbackStage>([
  DealFeedbackStage.DUE_DILIGENCE,
  DealFeedbackStage.DECLINED,
  DealFeedbackStage.TERM_SHEET_COMMITTED,
]);

export function feedbackStageTextColor(status: DealFeedbackStage): string {
  return DARK_FEEDBACK_STAGES.has(status) ? "#FFFFFF" : "var(--ink)";
}
