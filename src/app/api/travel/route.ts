import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { travelInputSchema } from "@/lib/travel-schema";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  // Everyone sees everyone's travel — useful for coordinating overlapping trips.
  const travel = await prisma.travel.findMany({ include: { user: true }, orderBy: { startDate: "asc" } });
  return NextResponse.json({ travel });
}

export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json();
  const parsed = travelInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;
  const trip = await prisma.travel.create({
    data: {
      userId: actingUser.id,
      city: data.city,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate || data.startDate),
      notes: data.notes ?? "",
    },
    include: { user: true },
  });
  return NextResponse.json({ trip }, { status: 201 });
}
