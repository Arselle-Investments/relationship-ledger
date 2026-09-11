import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { computeSequenceSteps, markNextSequenceStepDone, ActiveSequence } from "@/lib/sequences";
import { SequenceStepInput } from "@/lib/sequence-template-schema";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ templateId: z.string() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "templateId is required." }, { status: 400 });

  const [contact, template] = await Promise.all([
    prisma.contact.findUnique({ where: { id } }),
    prisma.sequenceTemplate.findUnique({ where: { id: parsed.data.templateId } }),
  ]);
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const startDate = todayISO();
  const activeSequence: ActiveSequence = {
    templateId: template.id,
    templateName: template.name,
    startDate,
    completed: false,
    steps: computeSequenceSteps(template.steps as unknown as SequenceStepInput[], startDate),
  };

  const updated = await prisma.contact.update({
    where: { id },
    data: { activeSequence },
    include: { owner: true, warmPath: true, company: true },
  });
  return NextResponse.json({ contact: updated });
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (!contact.activeSequence) return NextResponse.json({ error: "No active sequence." }, { status: 400 });

  const today = todayISO();
  const updatedSequence = markNextSequenceStepDone(contact.activeSequence as unknown as ActiveSequence, today);

  const updated = await prisma.contact.update({
    where: { id },
    data: { activeSequence: updatedSequence, lastContact: new Date(today) },
    include: { owner: true, warmPath: true, company: true },
  });
  return NextResponse.json({ contact: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const updated = await prisma.contact.update({
    where: { id },
    data: { activeSequence: Prisma.JsonNull },
    include: { owner: true, warmPath: true, company: true },
  });
  return NextResponse.json({ contact: updated });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
