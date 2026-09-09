import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { DataHygieneClient } from "@/components/data-hygiene/DataHygieneClient";
import { getStaleContacts } from "@/lib/followups";
import { getSettings } from "@/lib/settings";
import { Role } from "@prisma/client";

export default async function DataHygienePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, settings] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    getSettings(),
  ]);

  const stale = getStaleContacts(contacts, settings.staleDays);

  return (
    <AppShell activeHref="/data-hygiene" user={user} dataHygieneCount={stale.length}>
      <DataHygieneClient initialStale={stale} />
    </AppShell>
  );
}
