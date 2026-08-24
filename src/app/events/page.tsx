import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { EventsClient } from "@/components/events/EventsClient";
import { Role } from "@prisma/client";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [events, team] = await Promise.all([
    prisma.event.findMany({ orderBy: { startDate: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/events" user={user}>
      <EventsClient
        initialEvents={events}
        team={team}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
