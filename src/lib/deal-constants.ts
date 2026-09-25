import { AssetClass, DealStatus, FundraisingStage, InvestmentStrategy, InvestmentStructure } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

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

// Deal feedback (company/LP-level) uses the same fundraising pipeline as
// Contact — re-exported under this name so existing deal-feedback callers
// read naturally, without implying it's a separate vocabulary. PASSED_OPEN is
// the one label that genuinely differs by context: at the deal level, "open"
// means open to a *future deal*, not a future fund (see FUNDRAISING_STAGE_LABELS).
export const FEEDBACK_STATUS_LABELS: Record<FundraisingStage, string> = {
  ...FUNDRAISING_STAGE_LABELS,
  PASSED_OPEN: "Passed (open to future deals)",
};

export const FEEDBACK_STATUS_TAG_CLASS: Record<FundraisingStage, string> = {
  NOT_STARTED: "",
  OUTREACH_SENT: "",
  INITIAL_INTEREST: "brass",
  MEETING_OCCURRED: "brass",
  ACTIVE_PROSPECT: "brass",
  FINAL_CLOSE_POTENTIAL: "brass",
  DUE_DILIGENCE: "brass",
  COMMITTED: "forest",
  PASSED_OPEN: "",
  PASSED_NOT_INTERESTED: "rust",
  DO_NOT_CONTACT: "rust",
};
