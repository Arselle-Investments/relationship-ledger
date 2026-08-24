import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getSequenceTemplates } from "@/lib/sequence-templates";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { Role } from "@prisma/client";
import { SequenceStepInput } from "@/lib/sequence-template-schema";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; name?: string | null; email?: string | null; role: Role };

  const [settings, team, templates] = await Promise.all([
    getSettings(),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    getSequenceTemplates(),
  ]);

  return (
    <AppShell activeHref="/settings" user={user}>
      <SettingsClient
        initialSettings={settings}
        initialTeam={team}
        initialTemplates={templates.map((t) => ({ id: t.id, name: t.name, steps: t.steps as unknown as SequenceStepInput[] }))}
        currentUserId={user.id}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
        isAdmin={user.role === Role.ADMIN}
      />
    </AppShell>
  );
}
