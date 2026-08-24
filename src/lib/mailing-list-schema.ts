import { z } from "zod";
import { ContactTier, ContactType, MailingListMode } from "@prisma/client";

export const mailingListInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional().nullable(),
  mode: z.nativeEnum(MailingListMode).default(MailingListMode.STATIC),
  contactIds: z.array(z.string()).default([]),
  filterType: z.nativeEnum(ContactType).optional().nullable(),
  filterTier: z.nativeEnum(ContactTier).optional().nullable(),
  filterOwnerId: z.string().trim().optional().nullable(),
  filterTag: z.string().trim().optional().nullable(),
});

export type MailingListInput = z.infer<typeof mailingListInputSchema>;
