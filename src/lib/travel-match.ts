// Groups of terms that refer to the same place but don't share a literal
// substring — e.g. Agora's coarse "SF Bay Area" location for a contact
// should still match a trip a team member logs as "San Francisco". Kept
// short and deliberately conservative: each entry is a distinctive enough
// string that a plain .includes() check against it is low-risk of a false
// positive on unrelated location text.
const LOCATION_ALIAS_GROUPS: string[][] = [
  ["san francisco", "sf bay area", "bay area", "silicon valley"],
];

function inSameAliasGroup(a: string, b: string): boolean {
  return LOCATION_ALIAS_GROUPS.some((group) => group.some((x) => a.includes(x)) && group.some((x) => b.includes(x)));
}

/** Case-insensitive substring match against Contact.city — same heuristic-first approach as
 * event-type inference. No server-only imports, so this is safe to use from client components
 * (e.g. Look Ahead, which recomputes its window client-side) as well as API routes. */
export function contactMatchesCity(contact: { city: string | null }, city: string): boolean {
  const needle = city.trim().toLowerCase();
  if (!needle || !contact.city) return false;
  const contactCity = contact.city.toLowerCase();
  if (contactCity.includes(needle)) return true;
  return inSameAliasGroup(needle, contactCity);
}
