import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { computeDeliverableContacts } from "@/lib/deliverables";
import { DeliverablesClient } from "@/components/deliverables/DeliverablesClient";
import { Role } from "@prisma/client";

export default async function DeliverablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [deliverables, allContacts] = await Promise.all([
    prisma.deliverable.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({ include: { owner: true, warmPath: true }, orderBy: { name: "asc" } }),
  ]);

  const initialDeliverables = deliverables.map((deliverable) => ({
    deliverable,
    contacts: computeDeliverableContacts(deliverable, allContacts),
  }));

  return (
    <AppShell activeHref="/deliverables" user={user}>
      <DeliverablesClient
        initialDeliverables={initialDeliverables}
        allContacts={allContacts}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
