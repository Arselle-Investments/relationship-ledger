import { ContactStatus } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

// Natural pipeline order. PASSED is a terminal drop-off, not a forward stage,
// but still worth showing so the team can see how much falls out and where.
export const FUNNEL_STAGES: ContactStatus[] = [
  ContactStatus.NOT_STARTED,
  ContactStatus.OUTREACH_SENT,
  ContactStatus.AWAITING_REPLY,
  ContactStatus.RESPONDED,
  ContactStatus.MEETING_SCHEDULED,
  ContactStatus.DILIGENCE,
  ContactStatus.COMMITTED,
  ContactStatus.PASSED,
];

export function buildFunnelCounts(contacts: ContactWithRelations[]): { status: ContactStatus; count: number }[] {
  return FUNNEL_STAGES.map((status) => ({
    status,
    count: contacts.filter((c) => c.status === status).length,
  }));
}
