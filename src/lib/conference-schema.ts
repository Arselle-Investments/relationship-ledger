import { z } from "zod";
import { ConferenceType } from "@prisma/client";

export const conferenceInputSchema = z.object({
  name: z.string().trim().min(1, "Conference name is required."),
  startDate: z.string().trim().min(1, "Start date is required."),
  endDate: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  type: z.nativeEnum(ConferenceType).default(ConferenceType.OTHER),
  attendeeIds: z.array(z.string()).default([]),
  goals: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  organizer: z.string().trim().optional().nullable(),
  registrationLink: z.string().trim().optional().nullable(),
  registrationStatus: z.string().trim().optional().nullable(),
  registrationOpensAt: z.string().trim().optional().nullable(),
  dateConfidence: z.string().trim().optional().nullable(),
  fitNote: z.string().trim().optional().nullable(),
});

export type ConferenceInput = z.infer<typeof conferenceInputSchema>;
