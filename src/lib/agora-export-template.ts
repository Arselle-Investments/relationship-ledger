import { Company, Contact, RecordContext } from "@prisma/client";
import { CONTACT_TIER_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

/**
 * Agora's own "Import/Update Contacts" template — headers and column order
 * copied verbatim from the workbook Agora sent us (Downloads/contacts-
 * template.xlsx, "Template" sheet), so a file built from this list drops
 * straight into their importer without remapping on their end. Only fields
 * we actually have a confident, direct source for are filled in below (see
 * buildAgoraContactRow); everything else is left blank rather than guessed,
 * since a wrong value in Agora is worse than an empty cell someone fills in
 * by hand.
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
  "Date the Fund Overview Deck was Circulated (Interaction Log - Deliverables Sent)",
  "Low Commitment (Est.) (Interest Level)",
  "High Commitment (Est.) (Interest Level)",
  "Fund Deck sent? (Interaction Log - Deliverables Sent)",
  "Acting on Behalf of Company? (Interest Level)",
  "Acting on Behalf of Self? (Interest Level)",
  "Primary Location (Primary Location )",
  "Asset Class (Strategy Segmentation)",
  "Equity Check Range (Strategy Segmentation)",
  "Risk Profile (Strategy Segmentation)",
  "Add to Campaign - Holiday Card (Marketing Campaigns)",
  "Add to Campaign - End of Year Letter (Marketing Campaigns)",
  "Pipeline sent? (Interaction Log - Deliverables Sent)",
  "AREF I Platform Case Studies sent? (Interaction Log - Deliverables Sent)",
  "AREF I Returns Bridge(s) sent? (Interaction Log - Deliverables Sent)",
  "AREF I First Close Announcement_6.22.26 (Marketing Campaigns)",
  "Tier for Email Tracking (Marketing Campaigns)",
  "Advisory Board Member (Arselle Advisory Board Member)",
  "AREF I Prospect (Type of Prospect / Fundraising Tracking )",
  "AREF I - Emerging Mgr. Program (Type of Prospect / Fundraising Tracking )",
  "Deal LP or Opco / Mgmt Co. (Type of Prospect / Fundraising Tracking )",
  "Date Corporate Overview was circulated (Interaction Log - Deliverables Sent)",
  "Corporate Overview Deck sent? (Interaction Log - Deliverables Sent)",
  "Received Hiawatha Email 2026 (Interaction Log - Deliverables Sent)",
  "Strip Center Retail Investment Thesis - Sent (Interaction Log - Deliverables Sent)",
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
 * Builds one export row, in the given header order (defaults to
 * AGORA_TEMPLATE_HEADERS — pass Settings.agoraContactTemplateHeaders when a
 * revised template has been uploaded). Every value is a direct read of a
 * field we're confident about — see the module comment for why ambiguous
 * columns are left blank instead of inferred; a header this function doesn't
 * recognize at all (from a revised template) is blank for the same reason.
 */
export function buildAgoraContactRow(
  contact: Contact,
  company: Company | null,
  headers: readonly string[] = AGORA_TEMPLATE_HEADERS
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
    "Email Marketing Preference": "",
    "Receive Emails": "",
    "Date the Fund Overview Deck was Circulated (Interaction Log - Deliverables Sent)": "",
    "Low Commitment (Est.) (Interest Level)": contact.commitmentLow != null ? String(contact.commitmentLow) : "",
    "High Commitment (Est.) (Interest Level)": contact.commitmentHigh != null ? String(contact.commitmentHigh) : "",
    "Fund Deck sent? (Interaction Log - Deliverables Sent)": "",
    "Acting on Behalf of Company? (Interest Level)": "",
    "Acting on Behalf of Self? (Interest Level)": "",
    "Primary Location (Primary Location )": safeCell(contact.primaryLocation ?? ""),
    "Asset Class (Strategy Segmentation)": safeCell(assetClasses.join(", ")),
    "Equity Check Range (Strategy Segmentation)": equityCheckRange,
    "Risk Profile (Strategy Segmentation)": safeCell((company?.investmentStrategies ?? []).join(", ")),
    "Add to Campaign - Holiday Card (Marketing Campaigns)": yn(hasTag(tags, ["Holiday Card"])),
    "Add to Campaign - End of Year Letter (Marketing Campaigns)": yn(hasTag(tags, ["End Of Year Letter", "End of Year Letter"])),
    "Pipeline sent? (Interaction Log - Deliverables Sent)": "",
    "AREF I Platform Case Studies sent? (Interaction Log - Deliverables Sent)": "",
    "AREF I Returns Bridge(s) sent? (Interaction Log - Deliverables Sent)": "",
    "AREF I First Close Announcement_6.22.26 (Marketing Campaigns)": yn(
      hasTag(tags, ["AREF I First Close Announc"])
    ),
    "Tier for Email Tracking (Marketing Campaigns)": contact.emailTier != null ? String(contact.emailTier) : "",
    "Advisory Board Member (Arselle Advisory Board Member)": yn(hasTag(tags, ["Advisory Board Member"])),
    "AREF I Prospect (Type of Prospect / Fundraising Tracking )": yn(
      hasTag(tags, ["AREF I Active Prospects Import", "AREF I Status:"])
    ),
    "AREF I - Emerging Mgr. Program (Type of Prospect / Fundraising Tracking )": "",
    "Deal LP or Opco / Mgmt Co. (Type of Prospect / Fundraising Tracking )": yn(
      contact.recordContexts.includes(RecordContext.DEAL) || hasTag(tags, ["Capital Partner Outreach Import"])
    ),
    "Date Corporate Overview was circulated (Interaction Log - Deliverables Sent)": "",
    "Corporate Overview Deck sent? (Interaction Log - Deliverables Sent)": "",
    "Received Hiawatha Email 2026 (Interaction Log - Deliverables Sent)": yn(
      hasTag(tags, ["Received Hiawatha Email", "Hiawatha Recipient"])
    ),
    "Strip Center Retail Investment Thesis - Sent (Interaction Log - Deliverables Sent)": "",
  };

  return headers.map((h) => row[h] ?? "");
}
