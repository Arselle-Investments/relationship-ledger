import { Company, Contact, ContactTier, ContactType, FundraisingStage, User } from "@prisma/client";

export type ContactWithRelations = Contact & {
  owner: User | null;
  warmPath: User | null;
  // Only populated by queries that explicitly include it (Contacts and
  // Companies pages, where a linked company matters); every other caller of
  // this shared type still works without fetching a join it doesn't need.
  company?: Company | null;
};

export type ContactFormValues = {
  name: string;
  org: string;
  type: ContactType;
  tier: ContactTier;
  status: FundraisingStage;
  ownerId: string;
  warmPathId: string;
  email: string;
  phone: string;
  city: string;
  lastContact: string; // yyyy-mm-dd for <input type=date>
  cadenceOverrideDays: string; // kept as string for the form input, parsed on submit
  priorityQuarter: string;
  tags: string; // comma-separated in the form, split on submit
  notes: string;
  closeProbability: number | null;
};
