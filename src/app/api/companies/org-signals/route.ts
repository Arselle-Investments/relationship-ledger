import { NextRequest, NextResponse } from "next/server";
import { RecordContext } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";

// The prospect types worth catching when a new person joins an organization
// already marked for them.
const WATCHED_CONTEXTS: RecordContext[] = [RecordContext.FUND, RecordContext.DEAL, RecordContext.MGMT_CO];

/**
 * For an organization name typed on a new contact: which prospect types (Fund,
 * Deal, Mgmt Co) the organization is already marked with — on the company
 * itself, or on contacts already there — so the new contact can be checked
 * against them before it's created.
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ company: null, signals: [] });

  const company = await prisma.company.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [...(company ? [{ companyId: company.id }] : []), { org: { equals: name, mode: "insensitive" } }],
    },
    select: { name: true, recordContexts: true },
  });

  const signals = WATCHED_CONTEXTS.map((context) => ({
    context,
    companyFlagged: !!company?.recordContexts.includes(context),
    contactNames: contacts.filter((c) => c.recordContexts.includes(context)).map((c) => c.name),
  })).filter((s) => s.companyFlagged || s.contactNames.length > 0);

  return NextResponse.json({ company: company?.name ?? name, signals });
}
