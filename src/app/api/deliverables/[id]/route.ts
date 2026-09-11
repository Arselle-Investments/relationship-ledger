import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { deliverableInputSchema } from "@/lib/deliverable-schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;

  const body = await req.json();
  const parsed = deliverableInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const deliverable = await prisma.deliverable.update({
    where: { id },
    data: { name: data.name, tagMatches: data.tagMatches, notes: data.notes },
  });

  return NextResponse.json({ deliverable });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  await prisma.deliverable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
