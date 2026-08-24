import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { contactInputSchema, validateStatusNoteRule } from "@/lib/contact-schema";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { owner: true, warmPath: true },
  });
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;

  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const body = await req.json();
  const parsed = contactInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;
  const nextStatus = data.status ?? existing.status;
  const nextNotes = data.notes ?? existing.notes;

  const noteError = validateStatusNoteRule({
    previousStatus: existing.status,
    nextStatus,
    notes: nextNotes,
  });
  if (noteError) {
    return NextResponse.json({ error: noteError }, { status: 400 });
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.org !== undefined ? { org: data.org || null } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.tier !== undefined ? { tier: data.tier } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
      ...(data.warmPathId !== undefined ? { warmPathId: data.warmPathId || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.city !== undefined ? { city: data.city || null } : {}),
      ...(data.lastContact !== undefined
        ? { lastContact: data.lastContact ? new Date(data.lastContact) : null }
        : {}),
      ...(data.cadenceOverrideDays !== undefined
        ? { cadenceOverrideDays: data.cadenceOverrideDays }
        : {}),
      ...(data.priorityQuarter !== undefined ? { priorityQuarter: data.priorityQuarter || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: { owner: true, warmPath: true },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
