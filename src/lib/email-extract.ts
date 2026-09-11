import { isStaffEmail } from "@/lib/staff-emails";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Not real contact addresses even though they match the shape of one:
// Agora's own BCC/logging relay (shows up in forwarded email headers), and
// the "first.last@" template placeholder some source profiles use as a
// stand-in for "we don't actually have this person's email."
const NON_CONTACT_DOMAIN_RE = /agorareal\.com$|\.bcc\.clients\./i;
const PLACEHOLDER_LOCAL_RE = /^(first\.?last|firstname\.?lastname|jane\.?doe|john\.?doe|name)$/i;

/**
 * True unless the address is one of the known non-contact shapes — Agora's
 * own BCC/logging relay, its support alias, or a "first.last@" placeholder.
 * Exported so every ingestion path (not just the body-text regex fallback
 * below) can reject these before they're ever proposed as a new contact —
 * a message whose visible "From" ends up being Agora's own relay (it BCCs
 * itself on everything, for its own tracking) is real data worth keeping on
 * the correspondence record, just never as "the contact" on either end.
 */
export function isRealContactEmail(email: string): boolean {
  const [local, domain] = email.split("@");
  if (!domain || NON_CONTACT_DOMAIN_RE.test(domain)) return false;
  if (PLACEHOLDER_LOCAL_RE.test(local)) return false;
  return true;
}

/**
 * Regex fallback for when the AI extraction step didn't find a sender email
 * (rate-limited, out of credits, or just missed it) — a message body often
 * has the sender's email in a signature block even when their name doesn't
 * parse cleanly. Skips our own team's addresses the same way the AI-driven
 * extraction does, so an internal reply never gets attached as "the contact,"
 * and skips known non-contact/placeholder shapes (Agora's BCC relay, "first.last@").
 */
export function extractEmailFromText(text: string): string | null {
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;
  const candidate = matches
    .map((m) => m.toLowerCase())
    .find((m) => !m.endsWith("@arselleinvestments.com") && !isStaffEmail(m) && isRealContactEmail(m));
  return candidate ?? null;
}

// Local-part separators that plausibly split a first and last name —
// deliberately not splitting on plain runs of digits/letters with no
// separator (e.g. "jsmith23"), since a wrong guess there is worse than none.
const NAME_LIKE_LOCAL_RE = /^([a-zA-Z]+)[._-]([a-zA-Z]+)$/;

/**
 * Best-effort "firstname.lastname@" -> "Firstname Lastname" guess, for when
 * a message gives an email but no name at all — common on a forwarded
 * intro or a bare signature line. Only fires on an unambiguous two-part
 * local part; anything else (a single word, three-plus parts, initials)
 * is left alone rather than guessed at.
 */
export function guessNameFromEmail(email: string): string | null {
  const local = email.split("@")[0];
  const match = local.match(NAME_LIKE_LOCAL_RE);
  if (!match) return null;
  const [, first, last] = match;
  if (first.length < 2 || last.length < 2) return null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${cap(first)} ${cap(last)}`;
}

// Personal/free email providers a domain-derived org guess would be nonsense
// for ("gmail.com" isn't anyone's employer) — kept short and well-known
// rather than exhaustive, since the failure mode of missing one is just a
// blank org, not a wrong one.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "live.com",
  "msn.com",
  "comcast.net",
  "protonmail.com",
  "ymail.com",
]);

/**
 * Best-effort "name@stepstonegroup.com" -> "Stepstonegroup" guess for when a
 * message gives no org at all — the domain is at least a real signal, even
 * an imperfectly capitalized one a human can clean up. Skips personal email
 * providers (see PERSONAL_EMAIL_DOMAINS) and multi-part domains under a
 * shared registrar suffix (co.uk, com.au, etc.) rather than guess wrong.
 */
export function guessOrgFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
  const parts = domain.split(".");
  if (parts.length < 2) return null;
  const name = parts[0];
  if (name.length < 3) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
