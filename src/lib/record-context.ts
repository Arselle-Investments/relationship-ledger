import { RecordContext } from "@prisma/client";

// Spelled to match Agora's own "Prospect Type" multiselect exactly
// (confirmed by Bianca 2026-09-24) so it round-trips cleanly on export —
// same reasoning as CONTACT_TYPE_LABELS. See agora-export-template.ts for
// the actual export mapping.
export const RECORD_CONTEXT_LABELS: Record<RecordContext, string> = {
  FUND: "Fund",
  DEAL: "Deal",
  MGMT_CO: "Mgmt Co",
  PLATFORM_LEVEL_PROPCO: "Platform-Level PropCo",
  PLATFORM_LEVEL_OPCO: "Platform-Level OpCo",
};

export const RECORD_CONTEXT_TAG_CLASS: Record<RecordContext, string> = {
  FUND: "forest",
  DEAL: "brass",
  // Grouped under the one remaining tag color — only forest/brass/rust exist
  // in globals.css — to visually distinguish the platform-tracking values
  // from the original Fund/Deal pair.
  MGMT_CO: "rust",
  PLATFORM_LEVEL_PROPCO: "rust",
  PLATFORM_LEVEL_OPCO: "rust",
};
