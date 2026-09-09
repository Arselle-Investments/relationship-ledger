import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { CompanyReviewClient } from "@/components/companies/CompanyReviewClient";
import { clusterByNormalizedName, groupKeyFor } from "@/lib/company-match";
import { Role } from "@prisma/client";

export default async function CompanyReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [companiesRaw, dismissals] = await Promise.all([
    prisma.company.findMany({
      include: {
        _count: { select: { contacts: true, feedback: true, outreach: true } },
        // Only need to know whether at least one contact came from an Agora
        // export — that's what marks this company as the one already in use
        // on the real Companies tab, versus one that only exists because of
        // the messier capital-partner spreadsheet import.
        contacts: { select: { agoraRaw: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.companyMergeDismissal.findMany({ select: { groupKey: true } }),
  ]);
  const companies = companiesRaw.map(({ contacts, ...rest }) => ({
    ...rest,
    fromAgora: contacts.some((c) => c.agoraRaw != null),
  }));
  const dismissedKeys = new Set(dismissals.map((d) => d.groupKey));
  const clusters = clusterByNormalizedName(companies).filter(
    (cluster) => !dismissedKeys.has(groupKeyFor(cluster.map((c) => c.id)))
  );

  return (
    <AppShell activeHref="/companies/review" user={user} companyReviewCount={clusters.length}>
      <CompanyReviewClient
        initialClusters={clusters}
        canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR}
      />
    </AppShell>
  );
}
