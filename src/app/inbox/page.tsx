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

  const [suggested, ignored, pendingStageChanges, contacts] = await Promise.all([
    prisma.correspondence.findMany({
      where: { status: CorrespondenceStatus.SUGGESTED },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.correspondence.findMany({
      where: { status: CorrespondenceStatus.IGNORED },
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
    prisma.correspondence.findMany({
      where: { suggestionState: SuggestionState.PENDING },
      include: { contact: true },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/inbox" user={user} inboxCount={suggested.length + pendingStageChanges.length}>
      <InboxClient
        initialSuggested={suggested}
        initialIgnored={ignored}
        initialPendingStageChanges={pendingStageChanges}
        contacts={contacts}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
