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
  const capitalSource = await prisma.capitalSource.findUnique({ where: { id }, include: { consultant: true } });
  if (!capitalSource) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ capitalSource });
}

const schema = z.object({
  name: z.string().trim().min(1).optional(),
  shortName: z.string().trim().optional().nullable(),
  tier: z.number().int().min(1).max(4).optional().nullable(),
  outreachStatus: z.nativeEnum(FundraisingStage).optional(),
  actionability: z.string().optional(),
  nextStep: z.string().optional(),
  timing: z.string().trim().optional().nullable(),
  consultantId: z.string().trim().optional().nullable(),
  programManager: z.string().trim().optional().nullable(),
  consultantSource: z.string().optional(),
  knownCommitmentsCompetitors: z.string().optional(),
  knownCommitmentsOperators: z.string().optional(),
  overview: z.string().optional(),
  openDoorPolicy: z.string().optional(),
  minimumFundSize: z.string().trim().optional().nullable(),
  minimumFundSizeSource: z.string().optional(),
  typicalCheckSize: z.string().trim().optional().nullable(),
  typicalCheckSizeSource: z.string().optional(),
  keyContact: z.string().optional(),
  emailsWebsites: z.string().optional(),
  actionPlanSource: z.string().optional(),
  timeline: z.string().trim().optional().nullable(),
  capitalStatus: z.string().trim().optional().nullable(),
  capitalStatusSource: z.string().optional(),
  redFlags: z.string().optional(),
  arselleFit: z.string().optional(),
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
  const existing = await prisma.capitalSource.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data: Record<string, unknown> = { ...parsed.data };
  if ("consultantId" in data) data.consultantId = parsed.data.consultantId || null;

  const capitalSource = await prisma.capitalSource.update({ where: { id }, data, include: { consultant: true } });
  return NextResponse.json({ capitalSource });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  await prisma.capitalSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
