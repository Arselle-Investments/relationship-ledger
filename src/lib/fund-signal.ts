import { Contact } from "@prisma/client";

function isBlankAgoraValue(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  return s === "" || s === "-" || s === "'-";
}

// Tags that only ever get applied for real AREF I fundraising engagement —
// as opposed to "Holiday Card 2025" or "Capital Partner Outreach Import",
// which land on nearly everyone regardless of whether they're a fund
// prospect at all.
const AREF_TAG_RE = /^AREF I |^Invited to AREF Fund/i;

// Applied by a human reviewer (the Bianca cleanup pass) to a contact that
// otherwise would have shown up as a fund prospect by default — e.g.
// progressed past Not Started, but the "progress" wasn't really fund
// engagement (an internal/mistaken contact, a deal-only relationship, etc).
// This always wins over any positive signal below.
const EXCLUDED_TAG = "Not a Fund Prospect";

/**
 * Whether there's real evidence this contact is an AREF I fund prospect —
 * a recordContext explicitly marking them FUND, Agora's own "AREF I
 * Prospect" custom field being non-blank, or an AREF-specific tag. Absence
 * of a signal doesn't mean "definitely not" (recordContext is often just
 * never backfilled), which is why this stays a positive check rather than
 * something that gets used to delete or silently reclassify anyone.
 */
export function hasFundSignal(contact: Pick<Contact, "recordContexts" | "tags" | "agoraRaw">): boolean {
  if (contact.recordContexts.includes("FUND")) return true;
  if (contact.tags.some((t) => AREF_TAG_RE.test(t))) return true;
  const raw = contact.agoraRaw as Record<string, unknown> | null;
  if (raw && !isBlankAgoraValue(raw["AREF I PROSPECT"])) return true;
  return false;
}

/** Marked (by import provenance) as Deal-side only — Capital Partner
 * Outreach / LP List contacts with no accompanying FUND signal, i.e. the
 * clearest false-positives to have been showing up in a fund pipeline. */
export function isDealOnlySignal(contact: Pick<Contact, "recordContexts">): boolean {
  return contact.recordContexts.includes("DEAL") && !contact.recordContexts.includes("FUND");
}

/**
 * Whether a contact belongs in the AREF I Prospects funnel by default. A
 * contact sitting at Not Started with zero fund signal isn't meaningfully
 * "a prospect not yet contacted" — it's just someone in the system (often a
 * Holiday Card / Year End Letter recipient) with no known fund interest —
 * so those are held back from the pipeline view until something actually
 * happens (a real status change, or a tag/context confirming fund
 * engagement). A Deal-only contact is excluded regardless of stage, since
 * that recordContext is explicit LP/deal-side provenance. Nothing here
 * changes the underlying Contact record — it's purely what the funnel
 * chooses to display; "Show all contacts" on the Funnel page bypasses it.
 */
export function belongsInFundFunnel(
  contact: Pick<Contact, "recordContexts" | "tags" | "agoraRaw" | "status">
): boolean {
  if (contact.tags.includes(EXCLUDED_TAG)) return false;
  if (isDealOnlySignal(contact)) return false;
  if (contact.status === "NOT_STARTED" && !hasFundSignal(contact)) return false;
  return true;
}
