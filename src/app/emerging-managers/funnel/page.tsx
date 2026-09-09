import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { EmergingManagersFunnelClient } from "@/components/emerging-managers/EmergingManagersFunnelClient";
import { Role } from "@prisma/client";

export default async function EmergingManagersFunnelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [capitalSources, consultants] = await Promise.all([
    prisma.capitalSource.findMany({ orderBy: { name: "asc" } }),
    prisma.consultant.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell activeHref="/emerging-managers/funnel" user={user}>
      <EmergingManagersFunnelClient capitalSources={capitalSources} consultants={consultants} />
    </AppShell>
  );
}
