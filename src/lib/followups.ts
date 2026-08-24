import { ContactStatus } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";
import { ACTIVE_OUTREACH_STATUSES } from "@/lib/contact-constants";

const STALE_EXEMPT_STATUSES: ContactStatus[] = [ContactStatus.COMMITTED, ContactStatus.PASSED];

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
    .filter((c) => ACTIVE_OUTREACH_STATUSES.includes(c.status))
    .map((c) => {
      const cadence = c.cadenceOverrideDays ?? defaultCadenceDays;
      const days = daysBetween(c.lastContact, today);
      return { ...c, daysOverdue: days - cadence, cadence };
    })
    .filter((c) => c.daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export type StaleContact = ContactWithRelations & { staleReasons: string[] };

/** Contacts flagged for data hygiene regardless of status (except Committed/Passed). */
export function getStaleContacts(
  contacts: ContactWithRelations[],
  staleDays: number,
  today: Date = new Date()
): StaleContact[] {
  return contacts
    .filter((c) => !STALE_EXEMPT_STATUSES.includes(c.status))
    .map((c) => {
      const reasons: string[] = [];
      const days = daysBetween(c.lastContact, today);
      if (days >= staleDays) reasons.push(`no activity in ${days}d`);
      if (!c.org) reasons.push("missing organization");
      if (!c.ownerId) reasons.push("missing owner");
      return { ...c, staleReasons: reasons };
    })
    .filter((c) => c.staleReasons.length > 0);
}
