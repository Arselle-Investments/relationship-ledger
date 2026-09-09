import { DEV_TEAM } from "@/lib/dev-team";
import { extractEmailFromText } from "@/lib/email-extract";

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

// A forwarded/replied thread often has several people's signatures stacked in
// one body — most commonly whoever on our own team forwarded or introduced
// the new contact. Naively scanning the tail of the whole message risks
// attaching that staff member's own phone/title/city to the new contact
// instead. These markers let us recognize and skip any block that's theirs.
const STAFF_MARKERS = DEV_TEAM.flatMap((m) => [m.name.toLowerCase(), m.email.toLowerCase()]);

function lineMentionsStaff(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes("@arselleinvestments.com") || STAFF_MARKERS.some((marker) => lower.includes(marker));
}

// Splits a body into paragraph-like chunks, also breaking at common
// reply-chain markers ("On ... wrote:", "-----Original Message-----",
// "From:") so a quoted older message reads as its own block rather than
// bleeding into whichever block precedes it. A quote-prefixed ("> ") run of
// lines is deliberately NOT split line-by-line here — those lines still
// belong to one continuous block (typically a whole quoted signature), so a
// staff mention anywhere in that run still excludes the rest of it.
const THREAD_BREAK_RE = /^(on .{0,80} wrote:|-{2,}\s*original message\s*-{2,}|from:\s)/i;

function stripQuotePrefix(line: string): string {
  return line.replace(/^(>\s?)+/, "").trim();
}

function splitIntoBlocks(bodyText: string): string[][] {
  const blocks: string[][] = [[]];
  for (const raw of bodyText.split(/\r?\n/)) {
    const line = stripQuotePrefix(raw.trim());
    if (!line) {
      if (blocks[blocks.length - 1].length > 0) blocks.push([]);
      continue;
    }
    if (THREAD_BREAK_RE.test(line) && blocks[blocks.length - 1].length > 0) {
      blocks.push([]);
    }
    blocks[blocks.length - 1].push(line);
  }
  return blocks.filter((b) => b.length > 0);
}

function scanLines(lines: string[]): { phone: string | null; title: string | null; city: string | null; email: string | null } {
  let phone: string | null = null;
  let title: string | null = null;
  let city: string | null = null;
  let email: string | null = null;

  for (const line of lines.slice(-30)) {
    if (lineMentionsStaff(line)) continue;
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
    if (!email) {
      email = extractEmailFromText(line);
    }
  }

  return { phone, title, city, email };
}

/**
 * Pulls a phone/title/city/email out of a message body, preferring the block
 * of text that actually belongs to the contact being created (identified by
 * their extracted name/email) over whichever signature happens to sit at the
 * very end of the raw body — which, in a forwarded or introduced thread, is
 * often one of our own team's, not the new contact's.
 */
export function parseSignature(
  bodyText: string,
  contact?: { name?: string | null; email?: string | null }
): { phone: string | null; title: string | null; city: string | null; email: string | null } {
  const blocks = splitIntoBlocks(bodyText);
  const nonStaffBlocks = blocks.filter((block) => !block.some(lineMentionsStaff));

  const contactName = contact?.name?.toLowerCase().trim() || null;
  const contactEmail = contact?.email?.toLowerCase().trim() || null;

  let target: string[] | null = null;
  if (contactName || contactEmail) {
    target =
      nonStaffBlocks.find((block) =>
        block.some((l) => {
          const lower = l.toLowerCase();
          return (!!contactEmail && lower.includes(contactEmail)) || (!!contactName && lower.includes(contactName));
        })
      ) ?? null;
  }

  if (!target) {
    // No block clearly ties to the contact — fall back to the last non-staff
    // block (closest to the bottom of the real message, before older quoted
    // history), which is the closest approximation of "their" sign-off.
    target = nonStaffBlocks[nonStaffBlocks.length - 1] ?? null;
  }

  if (target) {
    const found = scanLines(target);
    if (found.phone || found.title || found.city || found.email) return found;
  }

  // Last resort: scan everything that isn't staff-attributed, tail-first.
  const allNonStaffLines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !lineMentionsStaff(l));
  return scanLines(allNonStaffLines);
}
