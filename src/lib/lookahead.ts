import { ContactWithRelations } from "@/types/contact";
import { ACTIVE_OUTREACH_STAGES } from "@/lib/contact-constants";

export type WindowBounds = { start: string; end: string };

export function windowBounds(days: number, today: Date = new Date()): WindowBounds {
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  return { start, end: end.toISOString().slice(0, 10) };
}

/**
 * Active-outreach contacts whose cadence deadline falls after today but within the
 * window — i.e. "coming due soon" rather than already overdue (that's Follow-up's job).
 */
export function getUpcomingCadenceContacts(
  contacts: ContactWithRelations[],
  defaultCadenceDays: number,
  windowEnd: string,
  today: string = new Date().toISOString().slice(0, 10)
): ContactWithRelations[] {
  return contacts.filter((c) => {
    if (!ACTIVE_OUTREACH_STAGES.includes(c.status) || !c.lastContact) return false;
    const cadence = c.cadenceOverrideDays ?? defaultCadenceDays;
    const dueDate = new Date(c.lastContact);
    dueDate.setDate(dueDate.getDate() + cadence);
    const dueISO = dueDate.toISOString().slice(0, 10);
    return dueISO > today && dueISO <= windowEnd;
  });
}
