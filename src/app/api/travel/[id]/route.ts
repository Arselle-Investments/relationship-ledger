import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { travelInputSchema } from "@/lib/travel-schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const existing = await prisma.travel.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const body = await req.json();
  const parsed = travelInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;
  const trip = await prisma.travel.update({
    where: { id },
    data: {
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate !== undefined
        ? { endDate: new Date(data.endDate || data.startDate || existing.startDate) }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: { user: true },
  });
  return NextResponse.json({ trip });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  await prisma.travel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
