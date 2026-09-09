import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { PrioritiesClient } from "@/components/priorities/PrioritiesClient";
import { Role } from "@prisma/client";

export default async function PrioritiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    prisma.company.findMany(),
  ]);

  return (
    <AppShell activeHref="/priorities" user={user}>
      <PrioritiesClient contacts={contacts} companies={companies} />
    </AppShell>
  );
}
