import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { FundraisingStage } from "@prisma/client";

const schema = z.object({
  status: z.nativeEnum(FundraisingStage).optional(),
  notes: z.string().trim().min(1).optional(),
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
  const existing = await prisma.dealFeedback.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Feedback not found." }, { status: 404 });

  const feedback = await prisma.dealFeedback.update({
    where: { id },
    data: { status: parsed.data.status, notes: parsed.data.notes },
    include: { company: true, contact: true },
  });
  return NextResponse.json({ feedback });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  await prisma.dealFeedback.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
