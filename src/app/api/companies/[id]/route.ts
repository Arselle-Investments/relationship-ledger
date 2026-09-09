import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { ContactTier } from "@prisma/client";

const schema = z.object({
  tier: z.nativeEnum(ContactTier).optional().nullable(),
  priorityQuarter: z.string().trim().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ("tier" in parsed.data) data.tier = parsed.data.tier || null;
  if ("priorityQuarter" in parsed.data) data.priorityQuarter = parsed.data.priorityQuarter?.trim() || null;

  const company = await prisma.company.update({ where: { id }, data });
  return NextResponse.json({ company });
}
