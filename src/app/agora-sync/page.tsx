import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { AgoraSyncClient } from "@/components/agora-sync/AgoraSyncClient";
import { Role } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { AGORA_TEMPLATE_HEADERS, isKnownAgoraTemplateHeader } from "@/lib/agora-export-template";
import { agoraSyncState, isExportableToAgora } from "@/lib/agora-sync";

export default async function AgoraSyncPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const syncFields = await prisma.contact.findMany({
    select: { email: true, agoraExportedAt: true, agoraChangesSyncedAt: true, updatedAt: true },
  });
  const states = syncFields.map((c) => ({ state: agoraSyncState(c), exportable: isExportableToAgora(c) }));
  const pendingCount = states.filter((s) => s.state === "new").length;
  const pendingHeldBackCount = states.filter((s) => s.state === "new" && !s.exportable).length;
  const changedCount = states.filter((s) => s.state === "changed" && s.exportable).length;
  const changedHeldBackCount = states.filter((s) => s.state === "changed" && !s.exportable).length;
  const fullCount = states.filter((s) => s.exportable).length;
  const companyPendingCount = await prisma.company.count({
    where: { agoraExportedAt: null, NOT: { sources: { hasSome: ["Agora Contact Export", "Agora Org Export"] } } },
  });
  const settings = await getSettings();
  const templateHeaders = (settings.agoraContactTemplateHeaders as string[] | null) ?? null;
  const exportLogs = await prisma.agoraExportLog.findMany({
    select: {
      id: true,
      kind: true,
      fileName: true,
      recordCount: true,
      skippedCount: true,
      createdByName: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell activeHref="/agora-sync" user={user}>
      <AgoraSyncClient
        pendingCount={pendingCount}
        pendingHeldBackCount={pendingHeldBackCount}
        changedCount={changedCount}
        changedHeldBackCount={changedHeldBackCount}
        fullCount={fullCount}
        companyPendingCount={companyPendingCount}
        initialExportLogs={exportLogs}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        initialTemplateHeaders={templateHeaders ?? [...AGORA_TEMPLATE_HEADERS]}
        initialTemplateIsCustom={templateHeaders != null}
        initialTemplateNewHeaders={templateHeaders ? templateHeaders.filter((h) => !isKnownAgoraTemplateHeader(h)) : []}
      />
    </AppShell>
  );
}
