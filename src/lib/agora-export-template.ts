import { Company, Contact, FundraisingStage, RecordContext } from "@prisma/client";
import { CONTACT_TIER_LABELS, FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { RECORD_CONTEXT_LABELS } from "@/lib/record-context";
import { safeCell } from "@/lib/excel-safety";

/**
 * Column names for the 3 fields we've asked Agora to add (see the AREF I
 * Stage Audit memo) — not yet part of their real template, so these are
 * deliberately NOT in AGORA_TEMPLATE_HEADERS below (adding them there would
 * put unrecognized columns in every export starting today). The mapping is
 * ready now so that the moment Agora adds the field and someone uploads a
 * revised template through Agora Sync, the column populates with a real
 * value on the very next export instead of coming through blank.
 */
export const PENDING_AGORA_FIELDS = {
  contactFunnelStage: "AREF I Funnel Stage",
  orgRecordContexts: "Fund/Deal Classification (Organization)",
  orgFunnelStage: "AREF I Funnel Stage (Organization)",
} as const;

/**
 * Agora's own "Import/Update Contacts" template — headers and column order
 * copied verbatim from the workbook Agora sent us (Downloads/contacts-
 * template (1).xlsx, "Template" sheet, confirmed against Bianca 2026-09-15),
 * so a file built from this list drops straight into their importer without
 * remapping on their end. Only fields we actually have a confident, direct
 * source for are filled in below (see buildAgoraContactRow); everything else
 * is left blank rather than guessed, since a wrong value in Agora is worse
 * than an empty cell someone fills in by hand. This is also just the
 * fallback for a fresh install or an explicit "reset to default" in Settings
 * — the live template lives in Settings.agoraContactTemplateHeaders and can
 * be revised there (see AgoraTemplateSection.tsx) without a code deploy.
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
  "Low Commitment (Est.) (Interest Level)",
  "High Commitment (Est.) (Interest Level)",
  "Acting on Behalf of Company? (Interest Level)",
  "Acting on Behalf of Self? (Interest Level)",
  "Primary Location (Primary Location )",
  "Asset Class (Strategy Segmentation)",
  "Equity Check Range (Strategy Segmentation)",
  "Risk Profile (Strategy Segmentation)",
  "Arselle Holiday Card (Mailing Lists)",
  "End of Year Investor Letter (Mailing Lists)",
  "AREF I Prospect (Type of Prospect / Fundraising Tracking )",
  "AREF I - Emerging Mgr. Program (Type of Prospect / Fundraising Tracking )",
  "Deal LP or Opco / Mgmt Co. (Type of Prospect / Fundraising Tracking )",
  "Received Hiawatha Email 2026 (Interaction Log - Deliverables Sent)",
  "HNW Syndication – Hiawatha (Amonte) (Mailing Lists)",
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

  const assetClasses = company?.targetAssetClasses ?? [];
  const sizeMin = company?.investmentSizeMin ?? null;
  const sizeMax = company?.investmentSizeMax ?? null;
  const equityCheckRange =
    sizeMin != null || sizeMax != null ? `${sizeMin ?? "?"}mm - ${sizeMax ?? "?"}mm` : "";

  const row: Record<string, string> = {
    Email: safeCell(contact.email ?? ""),
    "First Name": safeCell(first),
    "Last Name": safeCell(last),
    Title: "",
    Type: safeCell(contact.agoraType ?? ""),
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
    "Low Commitment (Est.) (Interest Level)": contact.commitmentLow != null ? String(contact.commitmentLow) : "",
    "High Commitment (Est.) (Interest Level)": contact.commitmentHigh != null ? String(contact.commitmentHigh) : "",
    "Acting on Behalf of Company? (Interest Level)": "",
    "Acting on Behalf of Self? (Interest Level)": "",
    "Primary Location (Primary Location )": safeCell(contact.primaryLocation ?? ""),
    "Asset Class (Strategy Segmentation)": safeCell(assetClasses.join(", ")),
    "Equity Check Range (Strategy Segmentation)": equityCheckRange,
    "Risk Profile (Strategy Segmentation)": safeCell((company?.investmentStrategies ?? []).join(", ")),
    // The two "(Mailing Lists)" columns below are populated dynamically from
    // listMappings instead of hardcoded here — see MailingList.agoraColumn —
    // since which Ledger list/tag maps to which Agora column is now an
    // admin-editable mapping, not a fixed pairing.
    "AREF I Prospect (Type of Prospect / Fundraising Tracking )": yn(
      hasTag(tags, ["AREF I Active Prospects Import", "AREF I Status:"])
    ),
    "AREF I - Emerging Mgr. Program (Type of Prospect / Fundraising Tracking )": "",
    "Deal LP or Opco / Mgmt Co. (Type of Prospect / Fundraising Tracking )": yn(
      contact.recordContexts.includes(RecordContext.DEAL) || hasTag(tags, ["Capital Partner Outreach Import"])
    ),
    "Received Hiawatha Email 2026 (Interaction Log - Deliverables Sent)": yn(
      hasTag(tags, ["Received Hiawatha Email", "Hiawatha Recipient"])
    ),
  };

  for (const mapping of listMappings) {
    row[mapping.agoraColumn] = yn(hasTag(tags, [mapping.filterTag]));
  }

  const agoraRaw = (contact.agoraRaw as unknown as Record<string, string> | null) ?? null;
  return headers.map((h) => row[h] ?? safeCell(agoraRaw?.[h.toUpperCase()] ?? ""));
}
