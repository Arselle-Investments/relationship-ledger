import { Deliverable } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

export type DeliverableWithContacts = {
  deliverable: Deliverable;
  contacts: ContactWithRelations[];
};
