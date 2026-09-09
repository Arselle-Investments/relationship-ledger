import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { DealDetailClient } from "@/components/deals/DealDetailClient";
import { Role } from "@prisma/client";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };
  const { id } = await params;

  const [deal, companies, contacts] = await Promise.all([
    prisma.deal.findUnique({
      where: { id },
      include: {
        feedback: { include: { company: true, contact: true }, orderBy: { createdAt: "desc" } },
        outreach: { include: { company: true }, orderBy: { sentAt: "desc" } },
      },
    }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ select: { id: true, name: true, companyId: true }, orderBy: { name: "asc" } }),
  ]);
  if (!deal) notFound();

  return (
    <AppShell activeHref="/deals" user={user}>
      <DealDetailClient
        initialDeal={deal}
        companies={companies}
        contacts={contacts}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        isAdmin={user.role === Role.ADMIN}
      />
    </AppShell>
  );
}
