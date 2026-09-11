/**
 * Classic edit distance: the minimum number of single-character inserts,
 * deletes, or substitutions to turn `a` into `b`. Used as a generic "how
 * close are these two strings" signal for catching typos a human would
 * still recognize as the same name (Esrailian/Esralian, Carr/Corr) that
 * exact or nickname-based matching can't see.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Whether two strings are close enough to plausibly be the same thing typed differently. */
export function isCloseMatch(a: string, b: string, maxDistance: number): boolean {
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > maxDistance) return false; // cheap short-circuit
  return levenshtein(a, b) <= maxDistance;
}
