import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { LookaheadClient } from "@/components/lookahead/LookaheadClient";
import { Role, DealStatus, FundraisingStage } from "@prisma/client";

export default async function LookaheadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, tasks, conferences, travel, settings, activeDeals, stalledConsultants, stalledCapitalSources, tier1Companies, arefTargetContacts] =
    await Promise.all([
      prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
      prisma.task.findMany({ include: { owner: true, contact: true } }),
      prisma.conference.findMany(),
      prisma.travel.findMany({ include: { user: true } }),
      getSettings(),
      prisma.deal.findMany({ where: { status: { in: [DealStatus.ACTIVE, DealStatus.UNDER_CONTRACT] } }, orderBy: { updatedAt: "desc" } }),
      prisma.consultant.findMany({ where: { outreachStatus: FundraisingStage.OUTREACH_SENT }, orderBy: { updatedAt: "desc" } }),
      prisma.capitalSource.findMany({ where: { outreachStatus: FundraisingStage.OUTREACH_SENT }, orderBy: { updatedAt: "desc" } }),
      prisma.company.findMany({ where: { tier: "TIER_1" }, orderBy: { name: "asc" } }),
      prisma.contact.findMany({
        where: {
          status: FundraisingStage.NOT_STARTED,
          correspondence: { some: { source: { in: ["aref_import", "capital_partner_untangle"] } } },
        },
        include: { owner: true, warmPath: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return (
    <AppShell activeHref="/lookahead" user={user}>
      <LookaheadClient
        contacts={contacts}
        tasks={tasks}
        conferences={conferences}
        travel={travel}
        settings={settings}
        activeDeals={activeDeals}
        stalledConsultants={stalledConsultants}
        stalledCapitalSources={stalledCapitalSources}
        tier1Companies={tier1Companies}
        arefTargetContacts={arefTargetContacts}
      />
    </AppShell>
  );
}
