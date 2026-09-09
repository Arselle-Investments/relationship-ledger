// Dates are stored as UTC midnight for a calendar day with no time
// component — format in UTC too, or a negative-offset timezone shows the
// previous day (same convention used throughout the app's date display).
function fmtMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Human-readable date range for outreach copy — "September 9–12", or
 * "September 28 – October 3" across a month boundary, with the year only
 * appended when it isn't the current one (nobody needs "2026" spelled out
 * for a trip six weeks out).
 */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const currentYear = new Date().getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const yearSuffix = start.getUTCFullYear() !== currentYear || endYear !== currentYear ? `, ${endYear}` : "";

  if (startISO === endISO) return `${fmtMonthDay(startISO)}${yearSuffix}`;

  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    const month = new Date(startISO).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    return `${month} ${start.getUTCDate()}–${end.getUTCDate()}${yearSuffix}`;
  }
  return `${fmtMonthDay(startISO)} – ${fmtMonthDay(endISO)}${yearSuffix}`;
}

/**
 * Non-AI fallback for travel outreach drafts — pure string interpolation, no
 * API call, no cost. Used as the default so a team member mass-emailing a
 * long list of contacts in a city doesn't burn AI credits on every one; AI
 * personalization is an opt-in for when there are just a few people worth the
 * extra polish. First-person from the traveler, since they're the one
 * signing it — not a third-person announcement about them.
 *
 * `contactName: null` produces a group-appropriate greeting for the
 * combined/BCC case, where the email isn't addressed to one specific person.
 */
export function buildGenericTravelEmail(params: {
  contactName: string | null;
  travelerName: string;
  city: string;
  startDate: string;
  endDate: string;
}): string {
  const greeting = params.contactName
    ? `Hi ${params.contactName.trim().split(/\s+/)[0] || params.contactName},`
    : "Hi all,";
  const dateRange = formatDateRange(params.startDate, params.endDate);
  return `${greeting}

I'll be in ${params.city} from ${dateRange} and would welcome the chance to connect while I'm in town — happy to meet for coffee or a call, whichever works best for you.

Let me know if you have some time.

Best,
${params.travelerName}`;
}
