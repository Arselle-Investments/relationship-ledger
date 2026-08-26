import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { TravelClient } from "@/components/travel/TravelClient";
import { Role } from "@prisma/client";

export default async function TravelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { id: string; name?: string | null; email?: string | null; role: Role };

  const travel = await prisma.travel.findMany({ include: { user: true }, orderBy: { startDate: "asc" } });

  return (
    <AppShell activeHref="/travel" user={user}>
      <TravelClient
        initialTravel={travel}
        currentUserId={user.id}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
