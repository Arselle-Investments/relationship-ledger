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

// Best-effort mapping from Agora's free-text "Type" into our own curated
// ContactType enum. Agora's field is far higher-cardinality (and ~87% just
// says "Investor"), so this is deliberately lossy — the exact Agora value is
// always preserved separately in agoraType/agoraRaw regardless of how (or
// whether) it maps here.
const AGORA_TYPE_TO_CONTACT_TYPE: Record<string, ContactType> = {
  endowment: ContactType.LP_INSTITUTIONAL,
  "public pension plan": ContactType.LP_INSTITUTIONAL,
  "pension fund": ContactType.LP_INSTITUTIONAL,
  "institutional investor": ContactType.LP_INSTITUTIONAL,
  "lp fund": ContactType.LP_INSTITUTIONAL,
  "family office": ContactType.FAMILY_OFFICE,
  "family office/ria": ContactType.FAMILY_OFFICE,
  "placement agent": ContactType.PLACEMENT_AGENT,
  advisor: ContactType.BROKER_ADVISOR,
  "wealth manager": ContactType.BROKER_ADVISOR,
  "gp fund": ContactType.SPONSOR_COGP,
  "private equity fund": ContactType.SPONSOR_COGP,
  platform: ContactType.SPONSOR_COGP,
  lawyer: ContactType.CONSULTANT,
  "service provider": ContactType.CONSULTANT,
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
