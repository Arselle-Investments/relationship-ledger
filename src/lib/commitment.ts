/** "$250K", "$1.5M", "$50,000" — compact dollars for the funnel. */
export function formatCommitment(amount: number): string {
  if (amount >= 1_000_000) return `$${trim(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${trim(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Reads what someone typed into a commitment cell: "50k", "$250,000", "1.5m".
 * Returns null for blank (clear it) and undefined when it isn't a number.
 */
export function parseCommitment(input: string): number | null | undefined {
  const s = input.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
  if (!m) return undefined;
  const mult = m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : m[2] === "b" ? 1_000_000_000 : 1;
  return Math.round(Number(m[1]) * mult);
}
