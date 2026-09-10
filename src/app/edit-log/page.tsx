import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { EditLogClient } from "@/components/edit-log/EditLogClient";
import { Role } from "@prisma/client";

export default async function EditLogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const entries = await prisma.editLogEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AppShell activeHref="/edit-log" user={user}>
      <EditLogClient initialEntries={entries} canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR} />
    </AppShell>
  );
}
