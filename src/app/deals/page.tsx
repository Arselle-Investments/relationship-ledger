import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { DealsClient } from "@/components/deals/DealsClient";
import { Role } from "@prisma/client";

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const deals = await prisma.deal.findMany({
    include: { _count: { select: { feedback: true, outreach: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell activeHref="/deals" user={user}>
      <DealsClient initialDeals={deals} canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR} />
    </AppShell>
  );
}
