import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { TargetCompaniesClient } from "@/components/priorities/TargetCompaniesClient";
import { Role } from "@prisma/client";

export default async function TargetCompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  // Excludes anything explicitly classified as deal-side-only (e.g. Capital
  // Partner Outreach) — a company with no classification yet still shows
  // here exactly as before, and a company that's both Deal and Fund still
  // shows since it's a real fund prospect too.
  const companies = await prisma.company.findMany({
    where: { OR: [{ NOT: { recordContexts: { has: "DEAL" } } }, { recordContexts: { has: "FUND" } }] },
  });

  return (
    <AppShell activeHref="/target-companies" user={user}>
      <TargetCompaniesClient companies={companies} canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR} />
    </AppShell>
  );
}
