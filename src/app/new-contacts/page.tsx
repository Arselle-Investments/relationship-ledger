import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { NewContactsClient } from "@/components/inbox/NewContactsClient";
import { CorrespondenceStatus, Role } from "@prisma/client";

export default async function NewContactsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [suggested, ignored, contacts] = await Promise.all([
    prisma.correspondence.findMany({
      where: { status: CorrespondenceStatus.SUGGESTED },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.correspondence.findMany({
      where: { status: CorrespondenceStatus.IGNORED },
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/new-contacts" user={user} newContactsCount={suggested.length}>
      <NewContactsClient
        initialSuggested={suggested}
        initialIgnored={ignored}
        contacts={contacts}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
