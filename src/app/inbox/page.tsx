import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { InboxClient } from "@/components/inbox/InboxClient";
import { CorrespondenceStatus, Role, SuggestionState } from "@prisma/client";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [pendingStageChanges, newContactsCount] = await Promise.all([
    prisma.correspondence.findMany({
      where: { suggestionState: SuggestionState.PENDING },
      include: { contact: true, consultant: true, capitalSource: true },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.correspondence.count({ where: { status: CorrespondenceStatus.SUGGESTED } }),
  ]);

  return (
    <AppShell activeHref="/inbox" user={user} inboxCount={pendingStageChanges.length} newContactsCount={newContactsCount}>
      <InboxClient
        initialPendingStageChanges={pendingStageChanges}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
