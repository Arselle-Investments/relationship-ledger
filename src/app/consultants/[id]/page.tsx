import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ConsultantDetailClient } from "@/components/emerging-managers/ConsultantDetailClient";
import { Role } from "@prisma/client";

export default async function ConsultantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };
  const { id } = await params;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    include: { capitalSources: { orderBy: { name: "asc" } } },
  });
  if (!consultant) notFound();

  return (
    <AppShell activeHref="/consultants" user={user}>
      <ConsultantDetailClient
        initialConsultant={consultant}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        isAdmin={user.role === Role.ADMIN}
      />
    </AppShell>
  );
}
