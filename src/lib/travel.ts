import { prisma } from "@/lib/prisma";
import { Travel, User } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";
import { contactMatchesCity } from "@/lib/travel-match";

export type TravelWithUser = Travel & { user: User };

export async function getMatchingContacts(city: string): Promise<ContactWithRelations[]> {
  const contacts = await prisma.contact.findMany({ include: { owner: true, warmPath: true } });
  return contacts.filter((c) => contactMatchesCity(c, city));
}
