import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/home/HomeClient";
import { Role, TaskStatus } from "@prisma/client";
import { TASK_TEAM_EMAILS } from "@/lib/task-constants";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; name?: string | null; email?: string | null; role: Role };
  const today = new Date().toISOString().slice(0, 10);

  const [allOpenTasks, travel, upcomingConferences, allConferences, team, contacts] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE } },
      include: { owner: true, contact: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.travel.findMany({
      where: { userId: user.id, endDate: { gte: new Date(today) } },
      orderBy: { startDate: "asc" },
    }),
    // Company-wide, not just this user's — Home is where you discover an
    // upcoming conference and add yourself (or someone else) to it, not only
    // a read-only recap of ones you're already down for.
    prisma.conference.findMany({
      where: { endDate: { gte: new Date(today) } },
      orderBy: { startDate: "asc" },
    }),
    prisma.conference.findMany(), // ConferenceModal needs the full history to detect a recurring series
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
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
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
