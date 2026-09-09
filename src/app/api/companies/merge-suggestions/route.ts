import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { clusterByNormalizedName, groupKeyFor } from "@/lib/company-match";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [companiesRaw, dismissals] = await Promise.all([
    prisma.company.findMany({
      include: {
        _count: { select: { contacts: true, feedback: true, outreach: true } },
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

  const clusters = clusterByNormalizedName(companies).filter((cluster) => !dismissedKeys.has(groupKeyFor(cluster.map((c) => c.id))));

  return NextResponse.json({ clusters });
}
