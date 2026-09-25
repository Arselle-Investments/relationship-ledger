import { Company, Contact, FundraisingStage } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS, FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { RECORD_CONTEXT_LABELS } from "@/lib/record-context";
import {
  COMPANY_ASSET_CLASS_LABELS,
  COMPANY_INVESTMENT_STRATEGY_LABELS,
  COMPANY_INVESTMENT_STRUCTURE_LABELS,
} from "@/lib/deal-constants";
import { safeCell } from "@/lib/excel-safety";

/**
 * Agora's real, fixed "AREF I – Stage" dropdown values (confirmed by Bianca
 * 2026-09-24), mapped from our own FundraisingStage. Not a straight reuse of
 * FUNDRAISING_STAGE_LABELS: Agora only has one "Decline" catch-all covering
 * both of our PASSED_NOT_INTERESTED and DO_NOT_CONTACT (DO_NOT_CONTACT
 * separately also sets Email Marketing Preference to Unsubscribed, see
 * below), and NOT_STARTED has no Agora equivalent — it just leaves the cell
 * blank until something actually happens.
 */
export const AREF_STAGE_TO_AGORA_VALUE: Record<FundraisingStage, string> = {
  NOT_STARTED: "",
  OUTREACH_SENT: FUNDRAISING_STAGE_LABELS.OUTREACH_SENT,
  INITIAL_INTEREST: FUNDRAISING_STAGE_LABELS.INITIAL_INTEREST,
  MEETING_OCCURRED: FUNDRAISING_STAGE_LABELS.MEETING_OCCURRED,
  ACTIVE_PROSPECT: FUNDRAISING_STAGE_LABELS.ACTIVE_PROSPECT,
  FINAL_CLOSE_POTENTIAL: FUNDRAISING_STAGE_LABELS.FINAL_CLOSE_POTENTIAL,
  DUE_DILIGENCE: FUNDRAISING_STAGE_LABELS.DUE_DILIGENCE,
  COMMITTED: FUNDRAISING_STAGE_LABELS.COMMITTED,
  PASSED_OPEN: FUNDRAISING_STAGE_LABELS.PASSED_OPEN,
  PASSED_NOT_INTERESTED: "Decline",
  DO_NOT_CONTACT: "Decline",
};

/**
 * Column names for fields we've asked Agora to add but that aren't part of
 * their real template yet — deliberately NOT in AGORA_TEMPLATE_HEADERS below
 * (adding them there would put unrecognized columns in every export starting
 * today). Both remaining entries are Organization-level; the Contact-level
 * funnel-stage field this used to include went live as "AREF I – Stage" on
 * 2026-09-24 and is now a real column below instead of pending.
 */
export const PENDING_AGORA_FIELDS = {
  orgRecordContexts: "Fund/Deal Classification (Organization)",
  orgFunnelStage: "AREF I Funnel Stage (Organization)",
} as const;

/**
 * Agora's own "Import/Update Contacts" template — headers and column order
 * copied verbatim from the workbook Agora sent us (Downloads/contacts-
 * template (3).csv, confirmed against Bianca 2026-09-25 — this is the third
 * revision; it renamed one group label and added 5 Company-level investment-
 * profile columns on top of the second revision's 40, see git history for
 * both prior revisions), so a file built from this list drops straight into their
 * importer without remapping on their end. Only fields we actually have a
 * confident, direct source for are filled in below (see
 * buildAgoraContactRow); everything else is left blank rather than guessed,
 * since a wrong value in Agora is worse than an empty cell someone fills in
 * by hand. This is also just the fallback for a fresh install or an explicit
 * "reset to default" in Settings — the live template lives in
 * Settings.agoraContactTemplateHeaders and can be revised there (see
 * AgoraTemplateSection.tsx) without a code deploy.
 */
export const AGORA_TEMPLATE_HEADERS = [
  "Email",
  "First Name",
  "Last Name",
  "Title",
  "Type",
  "ID/Passport Number",
  "Date of Birth",
  "Residency",
  "Preferred Name",
  "Job Title",
  "Lead Source",
  "Notes",
  "Main Phone",
  "Phone 2",
  "Phone 3",
  "Phone 4",
  "Phone Type 2",
  "Phone Type 3",
  "Phone Type 4",
  "Country",
  "State / Province",
  "City",
  "Street (Line 1)",
  "Zip / Postal Code",
  "Street (Line 2)",
  "Tags",
  "Priority",
  "Staff Members",
  "Company",
  "Main Tax ID",
  "Main Tax ID Type",
  "Email Marketing Preference",
  "Receive Emails",
  "Primary Location (Primary Location )",
  "Arselle Holiday Card (Mailing Lists)",
  "End of Year Investor Letter (Mailing Lists)",
  "HNW Syndication – Hiawatha (Amonte) (Mailing Lists)",
  // Group renamed from "Type of Prospect / Fundraising Tracking" to
  // "Propsect Type / Stage" on 2026-09-25 (third confirmed sighting of
  // Agora's own "Propsect" typo — it's real, not a transcription error).
  // Multiselect — RecordContext matches this field's 5 values exactly
  // (Mgmt Co, Fund, Deal, Platform-Level PropCo, Platform-Level OpCo), see
  // RECORD_CONTEXT_LABELS in record-context.ts.
  "Propsect Type (Propsect Type / Stage)",
  "AREF I – Stage (Propsect Type / Stage)",
  // Being deprecated by Agora — folding into an option under Prospect Type
  // (per Bianca 2026-09-24) — so deliberately left unmapped here too.
  "Platform OpCo Prospect (Propsect Type / Stage)",
  // Added 2026-09-25 — Company-level fields (Contact has no equivalent of
  // its own), sourced from the contact's linked company and written the same
  // across every contact there. Blank for contacts with no linked company.
  "Target Asset Class (Propsect Type / Stage)",
  "Investment Structures (Propsect Type / Stage)",
  "Investment Strategies (Propsect Type / Stage)",
  "Check Size (Min) (Propsect Type / Stage)",
  "Check Size (Max) (Propsect Type / Stage)",
] as const;

function hasTag(tags: string[], substrings: string[]): boolean {
  return tags.some((t) => substrings.some((s) => t.toLowerCase().includes(s.toLowerCase())));
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/**
 * Whether an uploaded template header is one this app already knows how to
 * populate — see buildAgoraContactRow. A header outside this list still gets
 * a column in the export (so the file's shape always matches what's
 * currently on file in Settings), just left blank on every row until a
 * developer wires up its real value source, same "never guess" rule as
 * every other ambiguous column here.
 */
export function isKnownAgoraTemplateHeader(header: string): boolean {
  return (AGORA_TEMPLATE_HEADERS as readonly string[]).includes(header);
}

/**
 * Which Mailing Lists (see MailingList.agoraColumn) write into which of
 * Agora's own "(Mailing Lists)" columns — e.g. this app's "Arselle Holiday
 * Card" list, filtered on the "Arselle Holiday Card" tag, maps to Agora's
 * "Arselle Holiday Card (Mailing Lists)" column. Built by the caller (a
 * cheap findMany against MailingList) so this stays a pure function.
 */
export type AgoraListColumnMapping = { filterTag: string; agoraColumn: string };

/**
 * Builds one export row, in the given header order (defaults to
 * AGORA_TEMPLATE_HEADERS — pass Settings.agoraContactTemplateHeaders when a
 * revised template has been uploaded). Every value is a direct read of a
 * field we're confident about — see the module comment for why ambiguous
 * columns are left blank instead of inferred. A header this function doesn't
 * explicitly populate falls back to the contact's own agoraRaw (Agora's last
 * known value for that exact column, from the most recent "Import from
 * Agora") rather than going blank — that's not a guess, it's just Agora's own
 * data read back to it, for columns (like a mailing list with no
 * agoraColumn mapping yet) this app doesn't independently track.
 */
export function buildAgoraContactRow(
  contact: Contact,
  company: Company | null,
  headers: readonly string[] = AGORA_TEMPLATE_HEADERS,
  listMappings: AgoraListColumnMapping[] = []
): string[] {
  const { first, last } = splitName(contact.name);
  const tags = contact.tags ?? [];
  const yn = (hit: boolean) => (hit ? "Yes" : "");

  const row: Record<string, string> = {
    Email: safeCell(contact.email ?? ""),
    "First Name": safeCell(first),
    "Last Name": safeCell(last),
    Title: "",
    // Now that ContactType is spelled to match Agora's own picklist exactly
    // (see contact-constants.ts), the curated type is what gets written back
    // out — unlike before, a manual reclassification in the app now does
    // reach Agora. OTHER still falls back to the raw agoraType (if any),
    // since "Other" itself isn't a value Agora would recognize as meaningful.
    Type: safeCell(contact.type === "OTHER" ? contact.agoraType ?? "" : CONTACT_TYPE_LABELS[contact.type]),
    "ID/Passport Number": "",
    "Date of Birth": "",
    Residency: "",
    "Preferred Name": "",
    "Job Title": "",
    "Lead Source": "",
    Notes: safeCell(contact.notes ?? ""),
    "Main Phone": safeCell(contact.phone ?? ""),
    "Phone 2": "",
    "Phone 3": "",
    "Phone 4": "",
    "Phone Type 2": "",
    "Phone Type 3": "",
    "Phone Type 4": "",
    Country: "",
    "State / Province": "",
    City: safeCell(contact.city ?? contact.primaryLocation ?? ""),
    "Street (Line 1)": "",
    "Zip / Postal Code": "",
    "Street (Line 2)": "",
    Tags: safeCell(tags.join(", ")),
    Priority: contact.tier ? CONTACT_TIER_LABELS[contact.tier] : "",
    "Staff Members": safeCell(contact.staffNames.join(", ")),
    Company: safeCell(company?.name ?? contact.org ?? ""),
    "Main Tax ID": "",
    "Main Tax ID Type": "",
    // Our own hard stop maps onto Agora's real unsubscribe field — a person
    // is either DO_NOT_CONTACT (write "Unsubscribed") or this stays blank
    // rather than guessing at a preference we don't actually know.
    "Email Marketing Preference": contact.status === FundraisingStage.DO_NOT_CONTACT ? "Unsubscribed" : "",
    "Receive Emails": "",
    "Primary Location (Primary Location )": safeCell(contact.primaryLocation ?? ""),
    // The three "(Mailing Lists)" columns below are populated dynamically
    // from listMappings instead of hardcoded here — see
    // MailingList.agoraColumn — since which Ledger list/tag maps to which
    // Agora column is now an admin-editable mapping, not a fixed pairing.
    "AREF I – Stage (Propsect Type / Stage)": AREF_STAGE_TO_AGORA_VALUE[contact.status],
    // Multiselect — RecordContext now matches Agora's 5-value Prospect Type
    // picklist exactly (confirmed by Bianca 2026-09-24), so this is a direct
    // pass-through, same "spelled to match Agora exactly" approach as Type.
    "Propsect Type (Propsect Type / Stage)": safeCell(
      contact.recordContexts.map((ctx) => RECORD_CONTEXT_LABELS[ctx]).join("; ")
    ),
    // "Platform OpCo Prospect (Propsect Type / Stage)" is being deprecated by
    // Agora into an option under Prospect Type (per Bianca 2026-09-24), so
    // deliberately left unpopulated here — it'll fall through to the
    // agoraRaw fallback below (blank) until Agora actually removes the column.
    // Company-level investment profile, denormalized onto every contact row
    // linked to that company (added 2026-09-25, per the new template revision).
    "Target Asset Class (Propsect Type / Stage)": safeCell(
      (company?.targetAssetClasses ?? []).map((c) => COMPANY_ASSET_CLASS_LABELS[c]).join("; ")
    ),
    "Investment Structures (Propsect Type / Stage)": safeCell(
      (company?.investmentStructures ?? []).map((s) => COMPANY_INVESTMENT_STRUCTURE_LABELS[s]).join("; ")
    ),
    "Investment Strategies (Propsect Type / Stage)": safeCell(
      (company?.investmentStrategies ?? []).map((s) => COMPANY_INVESTMENT_STRATEGY_LABELS[s]).join("; ")
    ),
    "Check Size (Min) (Propsect Type / Stage)": company?.investmentSizeMin != null ? String(company.investmentSizeMin) : "",
    "Check Size (Max) (Propsect Type / Stage)": company?.investmentSizeMax != null ? String(company.investmentSizeMax) : "",
  };

  for (const mapping of listMappings) {
    row[mapping.agoraColumn] = yn(hasTag(tags, [mapping.filterTag]));
  }

  const agoraRaw = (contact.agoraRaw as unknown as Record<string, string> | null) ?? null;
  return headers.map((h) => row[h] ?? safeCell(agoraRaw?.[h.toUpperCase()] ?? ""));
}
