import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { FunnelClient } from "@/components/funnel/FunnelClient";
import { Role } from "@prisma/client";

export default async function FunnelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const contacts = await prisma.contact.findMany({ include: { owner: true, warmPath: true } });

  return (
    <AppShell activeHref="/funnel" user={user}>
      <FunnelClient contacts={contacts} />
    </AppShell>
  );
}
