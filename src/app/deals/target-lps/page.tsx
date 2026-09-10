import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { TargetLPsClient } from "@/components/deals/TargetLPsClient";
import { Role } from "@prisma/client";

export default async function TargetLPsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, team, companies] = await Promise.all([
    prisma.contact.findMany({
      include: { owner: true, warmPath: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.company.findMany({
      where: { recordContext: "DEAL" },
      include: {
        feedback: { include: { deal: true, contact: true }, orderBy: { createdAt: "desc" } },
        outreach: { include: { deal: true }, orderBy: { sentAt: "desc" } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell activeHref="/deals/target-lps" user={user}>
      <TargetLPsClient
        contacts={contacts}
        team={team}
        companies={companies}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
