import { ContactType, Prisma, User } from "@prisma/client";
import { getField } from "@/lib/excel-import";

// Agora frequently uses "'-" or " - " as its own placeholder for "no value" —
// distinct from a genuinely empty cell — so both need to read as blank here.
export function isBlankAgoraValue(v: string | null | undefined): boolean {
  if (!v) return true;
  const t = v.trim().replace(/^'/, "").trim();
  return t === "" || t === "-" || t.toLowerCase() === "n/a";
}

function cleanAgora(v: string): string | null {
  return isBlankAgoraValue(v) ? null : v.trim().replace(/^'/, "").trim();
}

function parseAgoraNumber(v: string): number | null {
  const cleaned = cleanAgora(v);
  if (!cleaned) return null;
  const n = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Maps Agora's own "Type" picklist onto our curated ContactType subset — see
// CONTACT_TYPE_LABELS and AGORA_ARCHIVED_CONTACT_TYPES in contact-constants.ts
// for the full picture of what's in/out and why. Agora's exact wording is
// always preserved separately in agoraType/agoraRaw regardless of how (or
// whether) it maps here — this table only has a few deliberate synonym-folds
// (GP Fund/LP Fund -> Private Equity Fund, HNW Investor -> HNW, Family
// Office/RIA -> Wealth Manager, per Bianca 2026-09-16/17); everything else not
// listed here (Investor, Prospect, Potential Investor, Platform, the
// AU-regulatory and personal-relationship categories, etc.) deliberately
// falls through to OTHER rather than being guessed at. Notably, plain "Family
// Office" is ALSO left unmapped (falls to OTHER) on purpose — there is no
// generic Family Office value in our own ContactType anymore, and guessing
// single- vs. multi-family from the raw Agora value alone isn't possible; a
// human has to pick SINGLE_FAMILY_OFFICE or MULTI_FAMILY_OFFICE by hand.
const AGORA_TYPE_TO_CONTACT_TYPE: Record<string, ContactType> = {
  "public pension plan": ContactType.PUBLIC_PENSION_PLAN,
  "private pension plan": ContactType.PRIVATE_PENSION_PLAN,
  "institutional investor": ContactType.INSTITUTIONAL_INVESTOR,
  "pension fund": ContactType.INSTITUTIONAL_INVESTOR, // generic/legacy Agora value, not one of Agora's current Public/Private Pension Plan options
  endowment: ContactType.ENDOWMENT,
  foundation: ContactType.FOUNDATION,
  "insurance company": ContactType.INSURANCE_COMPANY,
  "sovereign wealth fund": ContactType.SOVEREIGN_WEALTH_FUND,
  "single family office": ContactType.SINGLE_FAMILY_OFFICE,
  "multi family office": ContactType.MULTI_FAMILY_OFFICE,
  "family office/ria": ContactType.WEALTH_MANAGER,
  "wealth manager": ContactType.WEALTH_MANAGER,
  hnw: ContactType.HNW,
  "hnw investor": ContactType.HNW,
  individual: ContactType.INDIVIDUAL,
  "family member": ContactType.FAMILY_MEMBER,
  "trusts/trustee": ContactType.TRUSTS_TRUSTEE,
  "private equity fund": ContactType.PRIVATE_EQUITY_FUND,
  "gp fund": ContactType.PRIVATE_EQUITY_FUND,
  "lp fund": ContactType.PRIVATE_EQUITY_FUND,
  "fund of funds": ContactType.FUND_OF_FUNDS,
  "hedge fund": ContactType.HEDGE_FUND,
  "placement agent": ContactType.PLACEMENT_AGENT,
  advisor: ContactType.ADVISOR,
  lawyer: ContactType.LAWYER,
  "service provider": ContactType.SERVICE_PROVIDER,
  "cre sponsor": ContactType.CRE_SPONSOR,
  broker: ContactType.BROKER,
};

export function mapAgoraType(agoraType: string | null): ContactType {
  if (!agoraType) return ContactType.OTHER;
  return AGORA_TYPE_TO_CONTACT_TYPE[agoraType.toLowerCase()] ?? ContactType.OTHER;
}

export type AgoraContactRow = {
  name: string;
  org: string | null;
  type: ContactType;
  email: string | null;
  phone: string | null;
  city: string | null;
  tags: string[];
  notes: string;
  ownerId: string | null;
  agoraType: string | null;
  primaryLocation: string | null;
  staffNames: string[];
  commitmentLow: number | null;
  commitmentHigh: number | null;
  emailTier: number | null;
  agoraRaw: Prisma.InputJsonValue;
};

/**
 * Maps one parsed Agora export row into a Contact create shape. Everything
 * we don't have a typed column for still survives in `agoraRaw` — the raw
 * parsed row, verbatim — so nothing from the export is silently dropped even
 * where we only promote a subset of the ~59 columns to real fields.
 */
export function buildAgoraContact(row: Record<string, string>, userByName: Map<string, User>): AgoraContactRow | null {
  const firstName = getField(row, ["FIRST NAME"]);
  const lastName = getField(row, ["LAST NAME"]);
  const name = `${firstName} ${lastName}`.trim();
  if (!name) return null;

  const agoraTypeRaw = cleanAgora(getField(row, ["TYPE"]));
  const primaryLocation = cleanAgora(getField(row, ["PRIMARY LOCATION"]));
  const city = cleanAgora(getField(row, ["CITY"])) ?? primaryLocation;

  const tags = getField(row, ["TAGS"])
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);

  const staffNames = getField(row, ["STAFF MEMBERS"])
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let ownerId: string | null = null;
  for (const staffName of staffNames) {
    const match = userByName.get(staffName.toLowerCase());
    if (match) {
      ownerId = match.id;
      break;
    }
  }

  const phoneRaw = cleanAgora(getField(row, ["PHONE NO."]));

  return {
    name,
    org: cleanAgora(getField(row, ["COMPANY"])),
    type: mapAgoraType(agoraTypeRaw),
    email: cleanAgora(getField(row, ["EMAIL"])),
    phone: phoneRaw,
    city,
    tags,
    notes: cleanAgora(getField(row, ["NOTES"])) ?? "",
    ownerId,
    agoraType: agoraTypeRaw,
    primaryLocation,
    staffNames,
    commitmentLow: parseAgoraNumber(getField(row, ["LOW COMMITMENT (EST.)"])),
    commitmentHigh: parseAgoraNumber(getField(row, ["HIGH COMMITMENT (EST.)"])),
    emailTier: (() => {
      const n = parseAgoraNumber(getField(row, ["TIER FOR EMAIL TRACKING"]));
      return n === null ? null : Math.round(n);
    })(),
    agoraRaw: row as unknown as Prisma.InputJsonValue,
  };
}
