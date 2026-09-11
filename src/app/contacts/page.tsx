import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ContactsClient } from "@/components/contacts/ContactsClient";
import { Role } from "@prisma/client";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, team] = await Promise.all([
    prisma.contact.findMany({
      include: { owner: true, warmPath: true, company: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/contacts" user={user}>
      <ContactsClient
        initialContacts={contacts}
        team={team}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
