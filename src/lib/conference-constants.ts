import { ConferenceType } from "@prisma/client";

export const CONFERENCE_TYPE_LABELS: Record<ConferenceType, string> = {
  CONFERENCE: "Conference",
  NETWORKING: "Networking",
  ROADSHOW: "Roadshow",
  OTHER: "Other",
};

function invert(labels: Record<ConferenceType, string>): Record<string, ConferenceType> {
  const out: Record<string, ConferenceType> = {};
  for (const key in labels) out[labels[key as ConferenceType].toLowerCase()] = key as ConferenceType;
  return out;
}

export const CONFERENCE_TYPE_BY_LABEL = invert(CONFERENCE_TYPE_LABELS);

// Matches the reference prototype's inferConferenceType exactly: a conference tracker is
// overwhelmingly conferences, so that's the default rather than a keyword match.
export function inferConferenceType(name: string): ConferenceType {
  const n = name.toLowerCase();
  if (/reception|social|roundtable|meetup|happy hour|mixer/.test(n)) return ConferenceType.NETWORKING;
  if (/webinar/.test(n)) return ConferenceType.OTHER;
  return ConferenceType.CONFERENCE;
}
