import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { FunnelClient } from "@/components/funnel/FunnelClient";
import { getSettings } from "@/lib/settings";
import { Role, FundraisingStage } from "@prisma/client";

export default async function FunnelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, companies, team, settings] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    prisma.company.findMany({ where: { recordContext: "FUND" }, include: { contacts: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <AppShell activeHref="/funnel" user={user}>
      <FunnelClient
        contacts={contacts}
        companies={companies}
        team={team}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        stageLabelOverrides={settings.funnelStageLabels as Partial<Record<FundraisingStage, string>> | null}
      />
    </AppShell>
  );
}
