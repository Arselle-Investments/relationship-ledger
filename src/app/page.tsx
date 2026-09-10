import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/home/HomeClient";
import { Role, TaskStatus } from "@prisma/client";
import { TASK_TEAM_EMAILS } from "@/lib/task-constants";
import { quarterBounds } from "@/lib/conferences";
import { getSettings } from "@/lib/settings";
import { getOverdueContacts } from "@/lib/followups";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; name?: string | null; email?: string | null; role: Role };
  const today = new Date().toISOString().slice(0, 10);
  const quarterEnd = quarterBounds(0).end;

  const [allOpenTasks, travel, upcomingConferences, allConferences, team, contacts, settings] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE } },
      include: { owner: true, contact: true },
      orderBy: { dueDate: "asc" },
    }),
    // Capped at the end of this quarter — Home is a "what's soon" dashboard,
    // not the full travel calendar. Adding a trip further out still works
    // fine (see /travel for the uncapped list); it just doesn't clutter Home.
    prisma.travel.findMany({
      where: { userId: user.id, endDate: { gte: new Date(today) }, startDate: { lte: new Date(quarterEnd) } },
      orderBy: { startDate: "asc" },
    }),
    // Company-wide, not just this user's — Home is where you discover an
    // upcoming conference and add yourself (or someone else) to it, not only
    // a read-only recap of ones you're already down for. Capped to this
    // quarter for the same "what's soon" reason as travel above.
    prisma.conference.findMany({
      where: { endDate: { gte: new Date(today) }, startDate: { lte: new Date(quarterEnd) } },
      orderBy: { startDate: "asc" },
    }),
    prisma.conference.findMany(), // ConferenceModal needs the full history to detect a recurring series
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({ include: { owner: true, warmPath: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  // "Mine" — either the sole owner, or named in a joint assigneeLabel (e.g.
  // "Aaron Greeno or Kev Zoryan"). "Team" is a sentinel meaning all three
  // task-team members jointly, not literal text — only counts as "mine" when
  // the signed-in user is actually one of the three.
  const isOnTaskTeam = !!user.email && TASK_TEAM_EMAILS.includes(user.email.toLowerCase());
  const myTasks = allOpenTasks.filter((t) => {
    if (t.ownerId === user.id) return true;
    if (t.assigneeLabel === "Team") return isOnTaskTeam;
    return !!(user.name && t.assigneeLabel?.includes(user.name));
  });

  const myOverdueContacts = getOverdueContacts(
    contacts.filter((c) => c.ownerId === user.id),
    settings.defaultCadenceDays
  );

  return (
    <AppShell activeHref="/" user={user}>
      <HomeClient
        currentUserId={user.id}
        userName={user.name ?? user.email ?? "there"}
        currentUserName={user.name ?? null}
        isOnTaskTeam={isOnTaskTeam}
        tasks={myTasks}
        travel={travel}
        conferences={upcomingConferences}
        allConferences={allConferences}
        team={team}
        contacts={contacts}
        overdueContacts={myOverdueContacts}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
