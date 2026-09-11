import { z } from "zod";
import { ContactTier, ContactType, FundraisingStage } from "@prisma/client";

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  org: z.string().trim().optional().nullable(),
  type: z.nativeEnum(ContactType).default(ContactType.OTHER),
  tier: z.nativeEnum(ContactTier).default(ContactTier.TIER_2),
  status: z.nativeEnum(FundraisingStage).default(FundraisingStage.NOT_STARTED),
  ownerId: z.string().trim().optional().nullable(),
  warmPathId: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  lastContact: z.string().trim().optional().nullable(), // ISO date string
  cadenceOverrideDays: z.number().int().positive().optional().nullable(),
  priorityQuarter: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim()).default([]),
  notes: z.string().optional().default(""),
  closeProbability: z.number().int().min(1).max(5).optional().nullable(),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Mirrors the reference prototype's required-field prompt (PRD 5.1): changing
 * status to anything other than "Not started" requires a non-empty note.
 */
export function validateStatusNoteRule(params: {
  previousStatus: FundraisingStage | null;
  nextStatus: FundraisingStage;
  notes: string | null | undefined;
}): string | null {
  const { previousStatus, nextStatus, notes } = params;
  const statusChanged = previousStatus === null || previousStatus !== nextStatus;
  if (nextStatus !== FundraisingStage.NOT_STARTED && statusChanged && !notes?.trim()) {
    return `Add a quick note before marking this contact "${nextStatus}": what's the context?`;
  }
  return null;
}
