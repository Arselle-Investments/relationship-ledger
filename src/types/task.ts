import { Contact, Task } from "@prisma/client";

export type TaskWithRelations = Task & {
  contact: Contact | null;
};
