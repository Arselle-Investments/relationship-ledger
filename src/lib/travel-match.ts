/** Case-insensitive substring match against Contact.city — same heuristic-first approach as
 * event-type inference. No server-only imports, so this is safe to use from client components
 * (e.g. Look Ahead, which recomputes its window client-side) as well as API routes. */
export function contactMatchesCity(contact: { city: string | null }, city: string): boolean {
  const needle = city.trim().toLowerCase();
  if (!needle || !contact.city) return false;
  return contact.city.toLowerCase().includes(needle);
}
