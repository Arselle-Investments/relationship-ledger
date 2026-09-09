import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { CapitalSourcesClient } from "@/components/emerging-managers/CapitalSourcesClient";
import { Role } from "@prisma/client";

export default async function CapitalSourcesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const capitalSources = await prisma.capitalSource.findMany({ include: { consultant: true }, orderBy: { name: "asc" } });

  return (
    <AppShell activeHref="/capital-sources" user={user}>
      <CapitalSourcesClient
        initialCapitalSources={capitalSources}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
