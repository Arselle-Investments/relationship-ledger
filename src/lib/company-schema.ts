import { z } from "zod";
import { ContactTier, ContactType } from "@prisma/client";

export const companyInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  type: z.nativeEnum(ContactType).default(ContactType.OTHER),
  tier: z.nativeEnum(ContactTier).optional().nullable(),
  city: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  linkedinUrl: z.string().trim().optional().nullable(),
  aum: z.string().trim().optional().nullable(),
  founded: z.string().trim().optional().nullable(),
  // Contacts (matched by their free-text org string) to attach to this
  // company as soon as it's created — the "New Companies" queue's whole
  // reason for existing: closing the gap where a contact's org was never
  // more than a string with no real Company record behind it.
  linkContactIds: z.array(z.string().trim().min(1)).default([]),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;
