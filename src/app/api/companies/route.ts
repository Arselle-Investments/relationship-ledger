import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { companyInputSchema } from "@/lib/company-schema";

/**
 * Creates a new Company record — used from the New Companies queue (an org
 * string on file with no company behind it yet) as well as any future
 * "add company" entry point. Optionally links existing contacts to it in the
 * same request, since the queue's whole point is closing that gap.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json();
  const parsed = companyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { linkContactIds, ...data } = parsed.data;

  const existing = await prisma.company.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
  if (existing) {
    return NextResponse.json({ error: `A company named "${data.name}" already exists.` }, { status: 409 });
  }

  const company = await prisma.company.create({
    data: {
      name: data.name,
      type: data.type,
      tier: data.tier ?? null,
      city: data.city || null,
      website: data.website || null,
      linkedinUrl: data.linkedinUrl || null,
      aum: data.aum || null,
      founded: data.founded || null,
    },
  });

  if (linkContactIds.length > 0) {
    await prisma.contact.updateMany({
      where: { id: { in: linkContactIds } },
      data: { companyId: company.id },
    });
  }

  return NextResponse.json({ company }, { status: 201 });
}
