import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/home/HomeClient";
import { Role, TaskStatus } from "@prisma/client";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; name?: string | null; email?: string | null; role: Role };
  const today = new Date().toISOString().slice(0, 10);

  const [allOpenTasks, travel, conferences] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE } },
      include: { owner: true, contact: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.travel.findMany({
      where: { userId: user.id, endDate: { gte: new Date(today) } },
      orderBy: { startDate: "asc" },
    }),
    prisma.conference.findMany({
      where: { attendeeIds: { has: user.id }, endDate: { gte: new Date(today) } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  // "Mine" — either the sole owner, or named in a joint assigneeLabel (e.g.
  // "Aaron Greeno or Kev Zoryan" / "Team"). Filtered here rather than by a
  // query since the label match is a substring check, not a column equality.
  const myTasks = allOpenTasks.filter(
    (t) => t.ownerId === user.id || (user.name && t.assigneeLabel?.includes(user.name))
  );

  return (
    <AppShell activeHref="/" user={user}>
      <HomeClient
        userName={user.name ?? user.email ?? "there"}
        tasks={myTasks}
        travel={travel}
        conferences={conferences}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
