import { z } from "zod";
import { ContactTier, ContactType, FundraisingStage, RecordContext } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  org: z.string().trim().optional().nullable(),
  type: z.nativeEnum(ContactType).default(ContactType.OTHER),
  tier: z.nativeEnum(ContactTier).default(ContactTier.TIER_2),
  status: z.nativeEnum(FundraisingStage).default(FundraisingStage.NOT_STARTED),
  ownerId: z.string().trim().optional().nullable(),
  warmPath: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  lastContact: z.string().trim().optional().nullable(), // ISO date string
  cadenceOverrideDays: z.number().int().positive().optional().nullable(),
  priorityQuarter: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim()).default([]),
  notes: z.string().optional().default(""),
  closeProbability: z.number().int().min(1).max(5).optional().nullable(),
  recordContexts: z.array(z.nativeEnum(RecordContext)).optional(),
  doNotContact: z.boolean().optional(),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Our own historical placeholder for "we don't have this person's real
 * email yet" (Agora requires an email to import a contact at all). Forces
 * doNotContact so nothing ever goes out to it while the real address is
 * still being tracked down — see Contact.doNotContact in schema.prisma.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith("@needemail.com");
}

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
    return `Add a quick note before marking this contact "${FUNDRAISING_STAGE_LABELS[nextStatus]}": what's the context?`;
  }
  return null;
}
