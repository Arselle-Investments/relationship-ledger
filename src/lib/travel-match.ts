// Groups of terms that refer to the same place but don't share a literal
// substring — e.g. Agora's coarse "SF Bay Area" location for a contact
// should still match a trip a team member logs as "San Francisco", and a
// specific suburb (kept on file for detail — "Foster City, CA") should
// still roll up to its metro for matching purposes ("SF Bay Area"). Kept
// short and deliberately conservative: each entry is a distinctive enough
// string that a plain .includes() check against it is low-risk of a false
// positive on unrelated location text. Only covers metros we actually have
// contacts/companies in — add a group here (not a stored field) whenever a
// new suburb needs to roll up, so the underlying data stays at its original,
// specific granularity.
const LOCATION_ALIAS_GROUPS: string[][] = [
  [
    "san francisco",
    "sf bay area",
    "bay area",
    "silicon valley",
    "san jose",
    "norcal",
    "nor cal",
    "northern california",
    "oakland",
    "palo alto",
    "menlo park",
    "foster city",
    "los altos",
    "stanford",
    "redwood city",
    "mountain view",
    "sunnyvale",
    "cupertino",
    "peninsula",
    "south bay",
    "east bay",
    "marin",
  ],
  ["los angeles", "socal", "southern california", "pasadena", "santa monica", "beverly hills", "culver city", "century city"],
  ["san diego", "la jolla"],
  ["chicago", "oak brook", "evanston", "naperville"],
  ["washington dc", "washington d.c.", "chevy chase", "bethesda", "arlington va", "mclean", "tysons"],
  ["miami", "coral gables", "coconut grove", "brickell"],
  ["philadelphia", "philly"],
  ["new york", "nyc", "manhattan", "brooklyn", "westchester"],
  ["boston", "cambridge ma"],
  ["seattle", "bellevue"],
];

function inSameAliasGroup(a: string, b: string): boolean {
  return LOCATION_ALIAS_GROUPS.some((group) => group.some((x) => a.includes(x)) && group.some((x) => b.includes(x)));
}

/** Case-insensitive substring match against Contact.city — same heuristic-first approach as
 * event-type inference. No server-only imports, so this is safe to use from client components
 * (e.g. Look Ahead, which recomputes its window client-side) as well as API routes.
 *
 * Checked in both directions: a trip logged as "Miami, FL" needs to match a
 * contact whose city is just "Miami" (contact is the substring of the trip),
 * and a trip logged as "New York" needs to match a contact city of "New
 * York, NY, United States" (trip is the substring of the contact) — Agora's
 * location data and what a team member types into the trip form are rarely
 * the same granularity. */
export function contactMatchesCity(contact: { city: string | null; primaryLocation?: string | null }, city: string): boolean {
  const needle = city.trim().toLowerCase();
  if (!needle) return false;
  // Check both the specific city and Agora's coarser primaryLocation (e.g.
  // "SF Bay Area") — a contact can have one, the other, or both on file.
  const candidates = [contact.city, contact.primaryLocation].filter((v): v is string => Boolean(v));
  if (candidates.length === 0) return false;
  // Agora sometimes lists more than one location for a contact, e.g.
  // "New York; Miami" — check each one on its own rather than the joined string.
  return candidates
    .flatMap((v) => v.split(";"))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((contactCity) => contactCity.includes(needle) || needle.includes(contactCity) || inSameAliasGroup(needle, contactCity));
}
