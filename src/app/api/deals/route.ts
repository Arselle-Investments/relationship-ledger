import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { DealStatus } from "@prisma/client";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const deals = await prisma.deal.findMany({
    include: { _count: { select: { feedback: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ deals });
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  assetClass: z.string().trim().optional().nullable(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const deal = await prisma.deal.create({
    data: {
      name: parsed.data.name,
      assetClass: parsed.data.assetClass || null,
      notes: parsed.data.notes ?? "",
      status: DealStatus.ACTIVE,
    },
  });
  return NextResponse.json({ deal }, { status: 201 });
}
