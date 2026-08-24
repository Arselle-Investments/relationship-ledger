import { Contact, Task, User } from "@prisma/client";

export type TaskWithRelations = Task & {
  owner: User | null;
  contact: Contact | null;
};
