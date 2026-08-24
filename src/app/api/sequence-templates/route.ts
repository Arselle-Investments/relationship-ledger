import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { sequenceTemplateInputSchema } from "@/lib/sequence-template-schema";
import { getSequenceTemplates } from "@/lib/sequence-templates";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const templates = await getSequenceTemplates();
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const body = await req.json();
  const parsed = sequenceTemplateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const template = await prisma.sequenceTemplate.create({
    data: { name: parsed.data.name, steps: parsed.data.steps },
  });
  return NextResponse.json({ template }, { status: 201 });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
