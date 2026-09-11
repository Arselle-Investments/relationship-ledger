import { prisma } from "@/lib/prisma";
import { Company, Travel, User } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";
import { contactMatchesCity } from "@/lib/travel-match";

export type TravelWithUser = Travel & { user: User };

export async function getMatchingContacts(city: string): Promise<ContactWithRelations[]> {
  const contacts = await prisma.contact.findMany({ include: { owner: true, warmPath: true } });
  return contacts.filter((c) => contactMatchesCity(c, city));
}

export type CompanyTravelMatch = { company: Company; contacts: ContactWithRelations[] };

/**
 * Companies whose own city (or Agora-sourced location) matches the trip,
 * paired with whichever of their contacts are on file — reuses the same
 * city-matching heuristic as getMatchingContacts, just against Company
 * instead of Contact. A company with no contacts on file yet still shows up
 * on its own, since the point is surfacing "someone worth meeting is based
 * here," known contact or not.
 */
export async function getMatchingCompanies(city: string): Promise<CompanyTravelMatch[]> {
  const companies = await prisma.company.findMany();
  const matched = companies.filter((c) => contactMatchesCity(c, city));
  if (matched.length === 0) return [];
  const contacts = await prisma.contact.findMany({
    where: { companyId: { in: matched.map((c) => c.id) } },
    include: { owner: true, warmPath: true },
  });
  return matched
    .map((company) => ({ company, contacts: contacts.filter((c) => c.companyId === company.id) }))
    .sort((a, b) => a.company.name.localeCompare(b.company.name));
}
