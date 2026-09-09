import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { FundraisingStage } from "@prisma/client";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const capitalSources = await prisma.capitalSource.findMany({
    include: { consultant: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ capitalSources });
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  shortName: z.string().trim().optional().nullable(),
});

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
  const capitalSource = await prisma.capitalSource.create({
    data: { name: parsed.data.name, shortName: parsed.data.shortName || null, outreachStatus: FundraisingStage.NOT_STARTED },
  });
  return NextResponse.json({ capitalSource }, { status: 201 });
}
