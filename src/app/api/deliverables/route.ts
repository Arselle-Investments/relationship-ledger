import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { deliverableInputSchema } from "@/lib/deliverable-schema";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const deliverables = await prisma.deliverable.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ deliverables });
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }

  const body = await req.json();
  const parsed = deliverableInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const deliverable = await prisma.deliverable.create({
    data: { name: data.name, tagMatches: data.tagMatches, notes: data.notes },
  });

  return NextResponse.json({ deliverable }, { status: 201 });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
