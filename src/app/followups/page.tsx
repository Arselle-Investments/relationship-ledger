import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { FollowupsClient } from "@/components/followups/FollowupsClient";
import { getOverdueContacts, getStaleContacts } from "@/lib/followups";
import { getOverdueSequenceContacts } from "@/lib/sequences";
import { getSettings } from "@/lib/settings";
import { Role } from "@prisma/client";

export default async function FollowupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, settings] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    getSettings(),
  ]);

  const overdue = getOverdueContacts(contacts, settings.defaultCadenceDays);
  const stale = getStaleContacts(contacts, settings.staleDays);
  const overdueSequences = getOverdueSequenceContacts(contacts);

  return (
    <AppShell activeHref="/followups" user={user}>
      <FollowupsClient
        initialOverdue={overdue}
        initialStale={stale}
        initialOverdueSequences={overdueSequences}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
