import { splitName, nicknameVariants } from "@/lib/name-match";
import { isCloseMatch } from "@/lib/fuzzy-match";

// Suffixes that don't distinguish one person from another for matching
// purposes — "Robert Siegfried" and "Robert Siegfried Jr." are almost always
// the same person recorded twice, not father and son both in the CRM.
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "esq"]);

/**
 * Reduces a person's name to a comparable core: lowercased, punctuation
 * stripped, trailing generational suffixes removed. Two names that reduce to
 * the same string are the same spelling, just written with different
 * capitalization or punctuation — used as a fallback for contacts with no
 * email to match on.
 */
export function normalizeContactName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(AB)"-style asides
    .replace(/["'.,]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/**
 * Groups contacts that share the exact same email (case-insensitive) — the
 * single most reliable duplicate signal, since two different people almost
 * never share an inbox, but the same person's name gets typed differently
 * across imports constantly (Roy Carr / Roy Corr, Dave Hood / David Hood).
 * Only clusters with more than one contact are returned.
 */
export function clusterByEmail<T extends { id: string; email: string | null }>(contacts: T[]): T[][] {
  const byEmail = new Map<string, T[]>();
  for (const c of contacts) {
    if (!c.email) continue;
    const key = c.email.trim().toLowerCase();
    if (!key) continue;
    const group = byEmail.get(key) ?? [];
    group.push(c);
    byEmail.set(key, group);
  }
  return Array.from(byEmail.values()).filter((group) => group.length > 1);
}

/**
 * Second-pass clustering for contacts with no email to match on: groups by
 * normalized name core. Skips anything already in an email-based cluster so
 * nothing shows up twice on the review page.
 */
export function clusterByNormalizedName<T extends { id: string; name: string }>(
  contacts: T[],
  alreadyClusteredIds: Set<string>
): T[][] {
  const byName = new Map<string, T[]>();
  for (const c of contacts) {
    if (alreadyClusteredIds.has(c.id)) continue;
    const key = normalizeContactName(c.name);
    if (!key) continue;
    const group = byName.get(key) ?? [];
    group.push(c);
    byName.set(key, group);
  }
  return Array.from(byName.values()).filter((group) => group.length > 1);
}

/** Canonical, order-independent key for a cluster, used to remember a dismissed suggestion. */
export function groupKeyFor(ids: string[]): string {
  return [...ids].sort().join(",");
}

function namesLookLikeSamePerson(nameA: string, nameB: string): boolean {
  const a = splitName(nameA);
  const b = splitName(nameB);
  if (!a || !b) return false;
  // A single-character edit budget catches real typos (Carr/Corr,
  // Esrailian/Esralian) without opening the door to distinct short surnames
  // that just happen to be two edits apart (Meyers/Peters, Lord/Long) — at
  // distance 2, common surnames collide far too often to trust.
  const lastMaxDist = Math.min(a.last.length, b.last.length) <= 3 ? 0 : 1;
  const lastClose = a.last === b.last || (lastMaxDist > 0 && isCloseMatch(a.last, b.last, lastMaxDist));
  if (!lastClose) return false;
  const firstMaxDist = Math.min(a.first.length, b.first.length) <= 4 ? 0 : 1;
  const firstMatch =
    a.first === b.first ||
    nicknameVariants(a.first).includes(b.first) ||
    (firstMaxDist > 0 && isCloseMatch(a.first, b.first, firstMaxDist));
  return firstMatch;
}

/**
 * A deliberately looser third pass, run only on demand (the "scan for more"
 * button) rather than on every page load: nickname-aware (Ron/Ronald) and
 * typo-tolerant (Carr/Corr, Esrailian/Esralian) on top of the exact-match
 * clustering above. Pairs are unioned into connected components — if A~B and
 * B~C both hold, all three end up in one group — since a scan can easily
 * surface a short chain of near-spellings for the same person.
 */
export function clusterByFuzzyName<T extends { id: string; name: string }>(
  contacts: T[],
  alreadyClusteredIds: Set<string>
): T[][] {
  const candidates = contacts.filter((c) => !alreadyClusteredIds.has(c.id));
  const parent = new Map<string, string>();
  function find(id: string): string {
    let root = id;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const c of candidates) parent.set(c.id, c.id);

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (namesLookLikeSamePerson(candidates[i].name, candidates[j].name)) {
        union(candidates[i].id, candidates[j].id);
      }
    }
  }

  const groups = new Map<string, T[]>();
  for (const c of candidates) {
    const root = find(c.id);
    const group = groups.get(root) ?? [];
    group.push(c);
    groups.set(root, group);
  }
  return Array.from(groups.values()).filter((g) => g.length > 1);
}
