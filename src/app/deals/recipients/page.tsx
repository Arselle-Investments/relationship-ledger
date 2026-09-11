import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { DealRecipientsClient } from "@/components/deals/DealRecipientsClient";
import { Role } from "@prisma/client";

export default async function DealRecipientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const companies = await prisma.company.findMany({
    where: { outreach: { some: {} } },
    include: {
      feedback: { include: { deal: true, contact: true }, orderBy: { createdAt: "desc" } },
      outreach: { include: { deal: true }, orderBy: { sentAt: "desc" } },
      _count: { select: { contacts: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell activeHref="/deals/recipients" user={user}>
      <DealRecipientsClient companies={companies} />
    </AppShell>
  );
}
