import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { computeListContacts } from "@/lib/mailing-lists";
import { ListsClient } from "@/components/lists/ListsClient";
import { Role } from "@prisma/client";

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [lists, allContacts, team] = await Promise.all([
    prisma.mailingList.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({ include: { owner: true, warmPath: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const listsWithContacts = await Promise.all(
    lists.map(async (list) => ({ list, contacts: await computeListContacts(list) }))
  );

  return (
    <AppShell activeHref="/lists" user={user}>
      <ListsClient
        initialLists={listsWithContacts}
        allContacts={allContacts}
        team={team}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
