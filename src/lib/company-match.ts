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

// Words that are extremely common in this specific domain (real estate /
// investment firm names) but aren't in LEGAL_SUFFIXES because stripping them
// unconditionally would be too aggressive for the *strict* match above (e.g.
// two different "X Capital" firms could collide). Used only for the looser,
// lower-confidence second pass below — every result still goes through
// human review before anything merges, so a false-positive pair here just
// costs a "Not duplicates" click rather than lost data.
const GENERIC_FIRM_WORDS = new Set([
  ...LEGAL_SUFFIXES,
  "capital",
  "partners",
  "partner",
  "group",
  "advisors",
  "advisor",
  "management",
  "investments",
  "investment",
  "ventures",
  "properties",
  "real estate",
  "realestate",
]);

/**
 * A looser, order-independent core: same idea as normalizeCompanyName, but
 * strips generic firm words wherever they appear (not just at the end) and
 * sorts what's left. Two names reduce to the same loose core in cases the
 * strict normalizer misses entirely — "Oaktree" vs "Oaktree Capital
 * Management," "Madison Dearborn" vs "Madison Dearborn Partners" — because
 * neither is a mere legal-suffix difference.
 */
function looseCoreName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,&/"“”]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !GENERIC_FIRM_WORDS.has(t));
  return tokens.sort().join(" ");
}

/**
 * Second-pass clustering for pairs the strict clusterer can't see. Only
 * returns groups that (a) have a non-empty loose core — so two companies
 * that are each *entirely* generic words don't collide — and (b) aren't
 * already flagged as a strict cluster, so nothing shows up twice on the
 * review page.
 */
export function clusterByLooseNormalizedName<T extends { id: string; name: string }>(
  companies: T[],
  alreadyClusteredIds: Set<string>
): T[][] {
  const byLoose = new Map<string, T[]>();
  for (const c of companies) {
    if (alreadyClusteredIds.has(c.id)) continue;
    const key = looseCoreName(c.name);
    if (!key) continue;
    const group = byLoose.get(key) ?? [];
    group.push(c);
    byLoose.set(key, group);
  }
  return Array.from(byLoose.values()).filter((group) => group.length > 1);
}

/** Canonical, order-independent key for a cluster, used to remember a dismissed suggestion. */
export function groupKeyFor(ids: string[]): string {
  return [...ids].sort().join(",");
}
