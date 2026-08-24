import { z } from "zod";
import { EventType } from "@prisma/client";

export const eventInputSchema = z.object({
  name: z.string().trim().min(1, "Event name is required."),
  startDate: z.string().trim().min(1, "Start date is required."),
  endDate: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  type: z.nativeEnum(EventType).default(EventType.OTHER),
  attendeeIds: z.array(z.string()).default([]),
  goals: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type EventInput = z.infer<typeof eventInputSchema>;
