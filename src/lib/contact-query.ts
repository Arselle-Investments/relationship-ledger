import { ContactTier, ContactType, Prisma } from "@prisma/client";

export function buildContactWhere(searchParams: URLSearchParams): Prisma.ContactWhereInput {
  const search = searchParams.get("search")?.trim();
  const type = searchParams.get("type") as ContactType | null;
  const tier = searchParams.get("tier") as ContactTier | null;
  const ownerId = searchParams.get("ownerId");

  return {
    ...(type ? { type } : {}),
    ...(tier ? { tier } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { org: { contains: search, mode: "insensitive" } },
            { tags: { has: search } },
          ],
        }
      : {}),
  };
}
