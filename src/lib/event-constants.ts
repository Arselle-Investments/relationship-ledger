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

export function inferEventType(name: string): EventType {
  const n = name.toLowerCase();
  if (n.includes("conference") || n.includes("summit") || n.includes("forum")) return EventType.CONFERENCE;
  if (n.includes("roadshow")) return EventType.ROADSHOW;
  if (n.includes("network") || n.includes("mixer") || n.includes("happy hour")) return EventType.NETWORKING;
  return EventType.OTHER;
}
