import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { eventInputSchema } from "@/lib/event-schema";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const events = await prisma.event.findMany({ orderBy: { startDate: "asc" } });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const body = await req.json();
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;
  const event = await prisma.event.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate || data.startDate),
      location: data.location || null,
      type: data.type,
      attendeeIds: data.attendeeIds,
      goals: data.goals ?? "",
      notes: data.notes ?? "",
    },
  });
  return NextResponse.json({ event }, { status: 201 });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
