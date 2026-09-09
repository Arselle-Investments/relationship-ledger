export type QuarterBounds = { start: string; end: string };

/** Bounds of the current quarter (offset in quarters from now), as yyyy-mm-dd strings. */
export function quarterBounds(offset = 0): QuarterBounds {
  const now = new Date();
  let q = Math.floor(now.getMonth() / 3) + offset;
  let y = now.getFullYear();
  while (q > 3) {
    q -= 4;
    y += 1;
  }
  while (q < 0) {
    q += 4;
    y -= 1;
  }
  const startMonth = q * 3;
  const start = new Date(y, startMonth, 1);
  const end = new Date(y, startMonth + 3, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Bounds of the current calendar year, as yyyy-mm-dd strings. */
export function yearBounds(offset = 0): QuarterBounds {
  const y = new Date().getFullYear() + offset;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

/** Has a registration link on file and a non-empty status — i.e. we know enough to actually register someone. */
export function conferenceIsConfirmedWithRegistration(ev: { registrationLink: string | null; registrationStatus: string | null }): boolean {
  return Boolean(ev.registrationLink?.trim() && ev.registrationStatus?.trim());
}

export function conferenceInQuarter(ev: { startDate: Date | string; endDate: Date | string }, bounds: QuarterBounds): boolean {
  const s = toISO(ev.startDate);
  const e = toISO(ev.endDate) || s;
  if (!s) return false;
  return s <= bounds.end && e >= bounds.start;
}

export function conferenceOverlapsWindow(
  ev: { startDate: Date | string; endDate: Date | string },
  bounds: { start: string; end: string }
): boolean {
  const s = toISO(ev.startDate);
  const e = toISO(ev.endDate) || s;
  if (!s) return false;
  return s <= bounds.end && e >= bounds.start;
}

function toISO(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}
