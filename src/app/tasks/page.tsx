import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { TasksClient } from "@/components/tasks/TasksClient";
import { Role } from "@prisma/client";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; name?: string | null; email?: string | null; role: Role };

  const [tasks, team, contacts] = await Promise.all([
    prisma.task.findMany({ include: { contact: true }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/tasks" user={user}>
      <TasksClient
        initialTasks={tasks}
        team={team}
        contacts={contacts}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        currentUserId={user.id}
      />
    </AppShell>
  );
}
