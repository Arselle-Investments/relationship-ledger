import { Deliverable } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

// Agora's own "blank" placeholders for a custom field that's never been
// touched — a bare dash or an Excel-safe-quoted dash, both meaning "no
// value," same as an empty string. Anything else (an actual "Yes", a date,
// a free-text note) counts as the field having fired.
function isBlankAgoraValue(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  return s === "" || s === "-" || s === "'-";
}

function hasCustomFieldHit(agoraRaw: unknown, keys: string[]): boolean {
  if (!agoraRaw || typeof agoraRaw !== "object" || keys.length === 0) return false;
  const raw = agoraRaw as Record<string, unknown>;
  return keys.some((key) => !isBlankAgoraValue(raw[key]));
}

/**
 * A contact counts as having received a deliverable if EITHER:
 * - one of its tagMatches shows up as a substring of one of their tags
 *   (case-insensitive) — same matching rule as a Mailing List's filterTag,
 *   OR'd across several patterns since the same real deliverable has
 *   sometimes picked up more than one tag wording over time; or
 * - one of its customFieldKeys is non-blank on the contact's agoraRaw —
 *   Agora's own custom fields (e.g. "RECEIVED HIAWATHA EMAIL 2026"), which
 *   is the authoritative source when Agora tracks the deliverable that way
 *   rather than (or in addition to, and sometimes instead of) a tag. Tags
 *   and custom fields are genuinely different things in Agora and can
 *   drift out of sync, so a deliverable that has both configured catches a
 *   contact either one flags.
 */
export function computeDeliverableContacts(
  deliverable: Pick<Deliverable, "tagMatches" | "customFieldKeys">,
  allContacts: ContactWithRelations[]
): ContactWithRelations[] {
  const needles = deliverable.tagMatches.map((t) => t.toLowerCase()).filter(Boolean);
  const fieldKeys = deliverable.customFieldKeys.filter(Boolean);
  if (needles.length === 0 && fieldKeys.length === 0) return [];
  return allContacts.filter(
    (c) =>
      c.tags.some((t) => needles.some((n) => t.toLowerCase().includes(n))) ||
      hasCustomFieldHit(c.agoraRaw, fieldKeys)
  );
}

// Deliverable-shaped Agora custom fields seen in past imports — offered as
// suggestions when setting up a deliverable's customFieldKeys so the team
// doesn't have to retype Agora's exact (all-caps) key spelling from memory.
// Not exhaustive: any key from a future Agora export works too, typed by hand.
export const KNOWN_AGORA_DELIVERABLE_FIELDS = [
  "ADD TO CAMPAIGN - HOLIDAY CARD",
  "ADD TO CAMPAIGN - END OF YEAR LETTER",
  "AREF I FIRST CLOSE ANNOUNCEMENT_6.22.26",
  "AREF I PLATFORM CASE STUDIES SENT?",
  "AREF I RETURNS BRIDGE(S) SENT?",
  "CORPORATE OVERVIEW DECK SENT?",
  "FUND DECK SENT?",
  "PIPELINE SENT?",
  "RECEIVED HIAWATHA EMAIL 2026",
  "STRIP CENTER RETAIL INVESTMENT THESIS - SENT",
];
