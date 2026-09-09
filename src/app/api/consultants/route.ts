import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const consultants = await prisma.consultant.findMany({
    include: { _count: { select: { capitalSources: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ consultants });
}

const schema = z.object({ name: z.string().trim().min(1, "Name is required.") });

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const consultant = await prisma.consultant.create({ data: { name: parsed.data.name } });
  return NextResponse.json({ consultant }, { status: 201 });
}
