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
 * extra polish.
 */
export function buildGenericTravelEmail(params: {
  contactName: string;
  travelerName: string;
  city: string;
  startDate: string;
  endDate: string;
}): string {
  const firstName = params.contactName.trim().split(/\s+/)[0] || params.contactName;
  const dateRange = formatDateRange(params.startDate, params.endDate);
  return `Hi ${firstName},

${params.travelerName} will be in ${params.city} from ${dateRange} and would love to connect if you're around — happy to grab coffee or hop on a quick call, whatever's easiest.

Let me know if you're free!

Best,
${params.travelerName}`;
}
