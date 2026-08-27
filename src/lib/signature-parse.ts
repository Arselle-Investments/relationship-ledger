// Heuristic-first email signature scraping — an email's signature block
// (last few lines of the body) often carries a phone number, job title, and
// city that would otherwise mean a manual lookup for every new contact
// created from correspondence. Deliberately simple regex/keyword matching
// rather than an AI call: signatures are formulaic enough that this covers
// the common cases, and it works even when the Anthropic account is out of
// credits.
const TITLE_KEYWORDS = [
  "chief executive officer",
  "chief financial officer",
  "chief operating officer",
  "chief investment officer",
  "chief marketing officer",
  "managing director",
  "managing partner",
  "general partner",
  "senior partner",
  "partner",
  "senior vice president",
  "executive vice president",
  "vice president",
  "president",
  "founder",
  "co-founder",
  "principal",
  "director",
  "associate",
  "analyst",
  "portfolio manager",
  "investment officer",
  "investor relations",
  "head of",
  "chairman",
  "chairwoman",
  "chair",
];

const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;

// "City, ST" or "City, State" — short line, capitalized, one comma.
const CITY_RE = /^[A-Z][a-zA-Z.\s]{1,25},\s*[A-Z]{2}([a-zA-Z]{1,20})?$/;

export function parseSignature(bodyText: string): { phone: string | null; title: string | null; city: string | null } {
  // Signatures live at the tail of a message — restrict to the last ~20
  // non-empty lines so a long quoted thread above doesn't get scanned too.
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-20);

  let phone: string | null = null;
  let title: string | null = null;
  let city: string | null = null;

  for (const line of lines) {
    if (!phone) {
      const m = line.match(PHONE_RE);
      if (m) phone = m[0].trim();
    }
    if (!title && line.length < 80) {
      const lower = line.toLowerCase();
      if (TITLE_KEYWORDS.some((k) => lower.includes(k))) {
        title = line.replace(/[|,;]+$/, "").trim();
      }
    }
    if (!city && line.length < 40 && CITY_RE.test(line)) {
      city = line;
    }
  }

  return { phone, title, city };
}
