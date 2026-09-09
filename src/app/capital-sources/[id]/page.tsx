import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { CapitalSourceDetailClient } from "@/components/emerging-managers/CapitalSourceDetailClient";
import { Role } from "@prisma/client";

export default async function CapitalSourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };
  const { id } = await params;

  const [capitalSource, consultants] = await Promise.all([
    prisma.capitalSource.findUnique({ where: { id }, include: { consultant: true } }),
    prisma.consultant.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!capitalSource) notFound();

  return (
    <AppShell activeHref="/capital-sources" user={user}>
      <CapitalSourceDetailClient
        initialCapitalSource={capitalSource}
        consultants={consultants}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        isAdmin={user.role === Role.ADMIN}
      />
    </AppShell>
  );
}
