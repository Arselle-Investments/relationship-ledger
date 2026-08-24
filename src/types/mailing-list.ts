import { MailingList } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";

export type MailingListWithContacts = {
  list: MailingList;
  contacts: ContactWithRelations[];
};
