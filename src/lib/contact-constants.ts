import { ContactStatus, ContactTier, ContactType } from "@prisma/client";

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

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  NOT_STARTED: "Not started",
  OUTREACH_SENT: "Outreach sent",
  AWAITING_REPLY: "Awaiting reply",
  RESPONDED: "Responded",
  MEETING_SCHEDULED: "Meeting scheduled",
  DILIGENCE: "Diligence",
  COMMITTED: "Committed",
  PASSED: "Passed",
};

export const ACTIVE_OUTREACH_STATUSES: ContactStatus[] = [
  ContactStatus.OUTREACH_SENT,
  ContactStatus.AWAITING_REPLY,
];

function invert<T extends string>(labels: Record<T, string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key in labels) {
    out[labels[key as T].toLowerCase()] = key as T;
  }
  return out;
}

export const CONTACT_TYPE_BY_LABEL = invert(CONTACT_TYPE_LABELS);
export const CONTACT_TIER_BY_LABEL = invert(CONTACT_TIER_LABELS);
export const CONTACT_STATUS_BY_LABEL = invert(CONTACT_STATUS_LABELS);
