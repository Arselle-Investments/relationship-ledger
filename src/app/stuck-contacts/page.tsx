import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getStuckContacts } from "@/lib/stuck-contacts";
import { getSettings } from "@/lib/settings";
import { StuckContactsClient } from "@/components/stuck-contacts/StuckContactsClient";
import { Role } from "@prisma/client";

export default async function StuckContactsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const settings = await getSettings();
  const stuck = await getStuckContacts(settings.stuckDays);

  return (
    <AppShell activeHref="/stuck-contacts" user={user}>
      <StuckContactsClient
        initialStuck={stuck}
        stuckDays={settings.stuckDays}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
