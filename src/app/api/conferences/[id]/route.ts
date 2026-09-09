import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { conferenceInputSchema } from "@/lib/conference-schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const existing = await prisma.conference.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Conference not found." }, { status: 404 });

  const body = await req.json();
  const parsed = conferenceInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const conference = await prisma.conference.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate !== undefined ? { endDate: new Date(data.endDate || data.startDate || existing.startDate) } : {}),
      ...(data.location !== undefined ? { location: data.location || null } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.attendeeIds !== undefined ? { attendeeIds: data.attendeeIds } : {}),
      ...(data.goals !== undefined ? { goals: data.goals } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.organizer !== undefined ? { organizer: data.organizer || null } : {}),
      ...(data.registrationLink !== undefined ? { registrationLink: data.registrationLink || null } : {}),
      ...(data.registrationStatus !== undefined ? { registrationStatus: data.registrationStatus || null } : {}),
      ...(data.registrationOpensAt !== undefined
        ? { registrationOpensAt: data.registrationOpensAt ? new Date(data.registrationOpensAt) : null }
        : {}),
      ...(data.dateConfidence !== undefined ? { dateConfidence: data.dateConfidence || null } : {}),
      ...(data.fitNote !== undefined ? { fitNote: data.fitNote || null } : {}),
    },
  });
  return NextResponse.json({ conference });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  await prisma.conference.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
