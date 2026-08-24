/** "YYYY-Qn" for the quarter `offset` quarters from now (offset 0 = current quarter). */
export function currentQuarterKey(offset = 0, now: Date = new Date()): string {
  let q = Math.floor(now.getMonth() / 3) + 1 + offset;
  let y = now.getFullYear();
  while (q > 4) {
    q -= 4;
    y += 1;
  }
  while (q < 1) {
    q += 4;
    y -= 1;
  }
  return `${y}-Q${q}`;
}

export function nextNQuarters(n: number, now: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => currentQuarterKey(i, now));
}
