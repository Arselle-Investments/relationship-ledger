import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { CompaniesClient } from "@/components/companies/CompaniesClient";
import { Role } from "@prisma/client";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, team] = await Promise.all([
    prisma.contact.findMany({
      include: { owner: true, warmPath: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/companies" user={user}>
      <CompaniesClient
        contacts={contacts}
        team={team}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
