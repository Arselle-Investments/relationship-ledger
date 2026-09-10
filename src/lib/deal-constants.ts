import { DealStatus, FundraisingStage } from "@prisma/client";
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
  FOLLOW_UP_ENGAGEMENT: "brass",
  ACTIVE_PROSPECT: "brass",
  DUE_DILIGENCE: "brass",
  COMMITTED: "forest",
  PASSED_OPEN: "",
  PASSED_NOT_INTERESTED: "rust",
  DO_NOT_CONTACT: "rust",
};
