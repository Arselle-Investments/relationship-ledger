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

export function eventInQuarter(ev: { startDate: Date | string; endDate: Date | string }, bounds: QuarterBounds): boolean {
  const s = toISO(ev.startDate);
  const e = toISO(ev.endDate) || s;
  if (!s) return false;
  return s <= bounds.end && e >= bounds.start;
}

export function eventOverlapsWindow(
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
