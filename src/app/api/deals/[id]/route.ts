import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin, requireEditor, requireUser } from "@/lib/permissions";
import { DealStatus } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      feedback: {
        include: { company: true, contact: true },
        orderBy: { createdAt: "desc" },
      },
      outreach: {
        include: { company: true },
        orderBy: { sentAt: "desc" },
      },
    },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  return NextResponse.json({ deal });
}

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.nativeEnum(DealStatus).optional(),
  assetClass: z.string().trim().optional().nullable(),
  notes: z.string().optional(),
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
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      name: parsed.data.name,
      status: parsed.data.status,
      assetClass: parsed.data.assetClass === undefined ? undefined : parsed.data.assetClass || null,
      notes: parsed.data.notes,
    },
  });
  return NextResponse.json({ deal });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
