import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ConsultantsClient } from "@/components/emerging-managers/ConsultantsClient";
import { Role } from "@prisma/client";

export default async function ConsultantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const consultants = await prisma.consultant.findMany({
    include: { _count: { select: { capitalSources: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell activeHref="/consultants" user={user}>
      <ConsultantsClient initialConsultants={consultants} canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR} />
    </AppShell>
  );
}
