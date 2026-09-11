import { Conference } from "@prisma/client";

// Minimal RFC 5545 (iCalendar) writer — just enough to hand Outlook, Google
// Calendar, or Apple Calendar a set of all-day conference events. No library
// needed for this; the format is plain text once you handle the handful of
// escaping rules below.

function escapeText(value: string): string {
  // Order matters: backslash first, or the following escapes would double-escape.
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function dateStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function allDayDateValue(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** ICS all-day events use an exclusive end date — the day *after* the last day the event covers. */
function exclusiveEndDate(endDate: Date): string {
  const next = new Date(endDate);
  next.setUTCDate(next.getUTCDate() + 1);
  return allDayDateValue(next);
}

export function buildConferenceIcs(conferences: Conference[], teamNameById: Map<string, string>): string {
  const now = dateStamp(new Date());
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Arselle Relationship Ledger//Conferences//EN", "CALSCALE:GREGORIAN"];

  for (const ev of conferences) {
    const attendeeNames = ev.attendeeIds.map((id) => teamNameById.get(id)).filter((n): n is string => Boolean(n));
    const descriptionParts = [
      ev.goals ? `Goals: ${ev.goals}` : null,
      attendeeNames.length > 0 ? `Attending: ${attendeeNames.join(", ")}` : null,
      ev.registrationLink ? `Registration: ${ev.registrationLink}` : null,
      ev.notes || null,
    ].filter((p): p is string => Boolean(p));

    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@arselle-relationship-ledger`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${allDayDateValue(ev.startDate)}`,
      `DTEND;VALUE=DATE:${exclusiveEndDate(ev.endDate)}`,
      `SUMMARY:${escapeText(ev.name)}`
    );
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (descriptionParts.length > 0) lines.push(`DESCRIPTION:${escapeText(descriptionParts.join("\n"))}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // ICS requires CRLF line endings.
  return lines.join("\r\n");
}
