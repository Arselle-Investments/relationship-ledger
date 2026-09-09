import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";

const schema = z.object({ companyId: z.string().trim().min(1, "Pick a company.") });

/** Marks a deal as sent/tracked to a company — separate from feedback, which requires an actual note. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const company = await prisma.company.findUnique({ where: { id: parsed.data.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const outreach = await prisma.dealOutreach.upsert({
    where: { dealId_companyId: { dealId: id, companyId: company.id } },
    update: { sentAt: new Date() },
    create: { dealId: id, companyId: company.id },
    include: { company: true },
  });
  return NextResponse.json({ outreach }, { status: 201 });
}
