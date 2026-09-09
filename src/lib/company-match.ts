// Common legal-entity suffixes that don't distinguish one company from
// another for our purposes — "Andell", "Andell Inc.", and "Andell Holdings,
// Inc." are almost always the same capital partner recorded three different
// ways, not three different partners. Stripped repeatedly from the end so
// "Holdings, Inc." (two suffix words) collapses the same as a single one.
const LEGAL_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "corp",
  "corporation",
  "co",
  "company",
  "ltd",
  "limited",
  "holdings",
  "holding",
  "lp",
  "llp",
  "plc",
]);

/**
 * Reduces a company name to a comparable core: lowercased, punctuation and
 * parenthetical asides stripped, and trailing legal-entity words removed.
 * Two names that reduce to the same string are treated as the same company
 * written differently, not two different companies.
 */
export function normalizeCompanyName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(ABR)"-style asides
    .replace(/[.,&/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/**
 * Groups a list of companies into clusters that normalize to the same core
 * name. Only clusters with more than one company are returned — a company
 * with no name-alike counterpart isn't a suggestion.
 */
export function clusterByNormalizedName<T extends { id: string; name: string }>(companies: T[]): T[][] {
  const byNormalized = new Map<string, T[]>();
  for (const c of companies) {
    const key = normalizeCompanyName(c.name);
    if (!key) continue;
    const group = byNormalized.get(key) ?? [];
    group.push(c);
    byNormalized.set(key, group);
  }
  return Array.from(byNormalized.values()).filter((group) => group.length > 1);
}

/** Canonical, order-independent key for a cluster, used to remember a dismissed suggestion. */
export function groupKeyFor(ids: string[]): string {
  return [...ids].sort().join(",");
}
