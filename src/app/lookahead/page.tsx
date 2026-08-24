import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { LookaheadClient } from "@/components/lookahead/LookaheadClient";
import { Role } from "@prisma/client";

export default async function LookaheadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, tasks, events, settings] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    prisma.task.findMany({ include: { owner: true, contact: true } }),
    prisma.event.findMany(),
    getSettings(),
  ]);

  return (
    <AppShell activeHref="/lookahead" user={user}>
      <LookaheadClient contacts={contacts} tasks={tasks} events={events} settings={settings} />
    </AppShell>
  );
}
