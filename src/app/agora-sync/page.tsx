import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { AgoraSyncClient } from "@/components/agora-sync/AgoraSyncClient";
import { Role } from "@prisma/client";

export default async function AgoraSyncPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const pendingCount = await prisma.contact.count({ where: { agoraExportedAt: null } });
  const companyPendingCount = await prisma.company.count({ where: { agoraExportedAt: null } });

  return (
    <AppShell activeHref="/agora-sync" user={user}>
      <AgoraSyncClient
        pendingCount={pendingCount}
        companyPendingCount={companyPendingCount}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
