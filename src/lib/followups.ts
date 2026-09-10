import { FundraisingStage } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";
import { ACTIVE_OUTREACH_STAGES } from "@/lib/contact-constants";

const STALE_EXEMPT_STATUSES: FundraisingStage[] = [
  FundraisingStage.COMMITTED,
  FundraisingStage.PASSED_OPEN,
  FundraisingStage.PASSED_NOT_INTERESTED,
  FundraisingStage.DO_NOT_CONTACT,
];

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Both dates are truncated to UTC midnight so this is a clean calendar-day count,
// not sensitive to what time of day the request happens to run.
function daysBetween(from: Date | null, to: Date): number {
  if (!from) return Infinity;
  return Math.round((utcMidnight(to) - utcMidnight(from)) / 86_400_000);
}

export type OverdueContact = ContactWithRelations & { daysOverdue: number; cadence: number };

/** Active-outreach-status contacts whose last-contact + cadence has passed, most-overdue first. */
export function getOverdueContacts(
  contacts: ContactWithRelations[],
  defaultCadenceDays: number,
  today: Date = new Date()
): OverdueContact[] {
  return contacts
    .filter((c) => ACTIVE_OUTREACH_STAGES.includes(c.status))
    .map((c) => {
      const cadence = c.cadenceOverrideDays ?? defaultCadenceDays;
      const days = daysBetween(c.lastContact, today);
      return { ...c, daysOverdue: days - cadence, cadence };
    })
    .filter((c) => c.daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// Stable identifiers for filtering, kept separate from the human-readable label
// (which, for "stale", carries a variable day count and can't be matched on directly).
export type StaleReasonCode = "never_contacted" | "stale" | "missing_org" | "missing_owner" | "placeholder_email";
export type StaleReason = { code: StaleReasonCode; label: string };

export const STALE_REASON_FILTER_LABELS: Record<StaleReasonCode, string> = {
  never_contacted: "No activity ever logged",
  stale: "No activity in a while",
  missing_org: "Missing organization",
  missing_owner: "Missing owner",
  placeholder_email: "Placeholder email",
};

export type StaleContact = ContactWithRelations & { staleReasons: StaleReason[] };

/** Contacts flagged for data hygiene regardless of status (except Committed/Passed). */
export function getStaleContacts(
  contacts: ContactWithRelations[],
  staleDays: number,
  today: Date = new Date()
): StaleContact[] {
  return contacts
    .filter((c) => !STALE_EXEMPT_STATUSES.includes(c.status))
    .map((c) => {
      const reasons: StaleReason[] = [];
      const days = daysBetween(c.lastContact, today);
      if (days >= staleDays) {
        reasons.push(
          Number.isFinite(days)
            ? { code: "stale", label: `no activity in ${days}d` }
            : { code: "never_contacted", label: "no activity ever logged" }
        );
      }
      if (!c.org) reasons.push({ code: "missing_org", label: "missing organization" });
      if (!c.ownerId) reasons.push({ code: "missing_owner", label: "missing owner" });
      // Agora's own placeholder convention for "we don't actually have this
      // person's email" — e.g. "tbd@needemail.com", "needemail2@firm.com".
      if (c.email?.toLowerCase().includes("needemail")) {
        reasons.push({ code: "placeholder_email", label: "placeholder email, needs a real address" });
      }
      return { ...c, staleReasons: reasons };
    })
    .filter((c) => c.staleReasons.length > 0);
}
