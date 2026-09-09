import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin, requireEditor, requireUser } from "@/lib/permissions";
import { FundraisingStage } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const consultant = await prisma.consultant.findUnique({
    where: { id },
    include: { capitalSources: { orderBy: { name: "asc" } } },
  });
  if (!consultant) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ consultant });
}

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  capitalSourcesCoveredNote: z.string().optional(),
  intakeProcess: z.string().optional(),
  knownContacts: z.string().optional(),
  nextStep: z.string().optional(),
  outreachStatus: z.nativeEnum(FundraisingStage).optional(),
  verificationNotes: z.string().optional(),
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
  const existing = await prisma.consultant.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const consultant = await prisma.consultant.update({
    where: { id },
    data: parsed.data,
    include: { capitalSources: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ consultant });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  await prisma.consultant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
