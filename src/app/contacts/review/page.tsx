import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ContactReviewClient } from "@/components/contacts/ContactReviewClient";
import { clusterByEmail, clusterByNormalizedName, groupKeyFor } from "@/lib/contact-dedupe";
import { Role } from "@prisma/client";

export default async function ContactReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, dismissals] = await Promise.all([
    prisma.contact.findMany({
      include: { owner: true, _count: { select: { tasks: true, correspondence: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.contactMergeDismissal.findMany({ select: { groupKey: true } }),
  ]);
  const dismissedKeys = new Set(dismissals.map((d) => d.groupKey));

  const emailClusters = clusterByEmail(contacts).filter(
    (cluster) => !dismissedKeys.has(groupKeyFor(cluster.map((c) => c.id)))
  );
  const emailIds = new Set(emailClusters.flatMap((cluster) => cluster.map((c) => c.id)));
  const nameClusters = clusterByNormalizedName(contacts, emailIds).filter(
    (cluster) => !dismissedKeys.has(groupKeyFor(cluster.map((c) => c.id)))
  );
  const clusters = [
    ...emailClusters.map((cluster) => ({ cluster, matchedBy: "email" as const })),
    ...nameClusters.map((cluster) => ({ cluster, matchedBy: "name" as const })),
  ];

  return (
    <AppShell activeHref="/contacts/review" user={user} contactReviewCount={clusters.length}>
      <ContactReviewClient
        initialClusters={clusters}
        allContacts={contacts}
        dismissedKeys={Array.from(dismissedKeys)}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
