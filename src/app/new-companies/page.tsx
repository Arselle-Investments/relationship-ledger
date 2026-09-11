import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { NewCompaniesClient } from "@/components/companies/NewCompaniesClient";
import { normalizeCompanyName } from "@/lib/company-match";
import { Role } from "@prisma/client";

export default async function NewCompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as { name?: string | null; email?: string | null; role: Role };

  const [contacts, companies, dismissals] = await Promise.all([
    prisma.contact.findMany({
      where: { org: { not: null } },
      select: { id: true, name: true, org: true, email: true, city: true, companyId: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
    prisma.newCompanyDismissal.findMany({ select: { orgKey: true } }),
  ]);

  const companyNameKeys = new Set(companies.map((c) => normalizeCompanyName(c.name)));
  const dismissedKeys = new Set(dismissals.map((d) => d.orgKey));

  const groupsByKey = new Map<string, { org: string; contacts: typeof contacts }>();
  for (const c of contacts) {
    if (!c.org || c.companyId) continue; // already linked to a company — not an orphan
    const key = normalizeCompanyName(c.org);
    if (!key || companyNameKeys.has(key) || dismissedKeys.has(key)) continue;
    const group = groupsByKey.get(key);
    if (group) group.contacts.push(c);
    else groupsByKey.set(key, { org: c.org, contacts: [c] });
  }
  const groups = Array.from(groupsByKey.values()).sort((a, b) => a.org.localeCompare(b.org));

  return (
    <AppShell activeHref="/new-companies" user={user} newCompaniesCount={groups.length}>
      <NewCompaniesClient initialGroups={groups} allCompanies={companies} canEdit={user.role === Role.ADMIN || user.role === Role.EDITOR} />
    </AppShell>
  );
}
