import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ConferencesClient } from "@/components/conferences/ConferencesClient";
import { Role } from "@prisma/client";

export default async function ConferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [conferences, team] = await Promise.all([
    prisma.conference.findMany({ orderBy: { startDate: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/conferences" user={user}>
      <ConferencesClient
        initialConferences={conferences}
        team={team}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
