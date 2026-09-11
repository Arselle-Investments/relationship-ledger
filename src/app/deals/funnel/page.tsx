import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { DealCapFunnelClient } from "@/components/deals/DealCapFunnelClient";
import { Role, DealStatus } from "@prisma/client";

export default async function DealCapFunnelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const deals = await prisma.deal.findMany({
    where: { status: DealStatus.ACTIVE },
    include: { feedback: { include: { company: true, contact: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell activeHref="/deals/funnel" user={user}>
      <DealCapFunnelClient deals={deals} />
    </AppShell>
  );
}
