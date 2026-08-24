import { EventType } from "@prisma/client";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CONFERENCE: "Conference",
  NETWORKING: "Networking",
  ROADSHOW: "Roadshow",
  OTHER: "Other",
};

function invert(labels: Record<EventType, string>): Record<string, EventType> {
  const out: Record<string, EventType> = {};
  for (const key in labels) out[labels[key as EventType].toLowerCase()] = key as EventType;
  return out;
}

export const EVENT_TYPE_BY_LABEL = invert(EVENT_TYPE_LABELS);

// Matches the reference prototype's inferEventType exactly: a conference tracker is
// overwhelmingly conferences, so that's the default rather than a keyword match.
export function inferEventType(name: string): EventType {
  const n = name.toLowerCase();
  if (/reception|social|roundtable|meetup|happy hour|mixer/.test(n)) return EventType.NETWORKING;
  if (/webinar/.test(n)) return EventType.OTHER;
  return EventType.CONFERENCE;
}
