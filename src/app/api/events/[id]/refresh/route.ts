import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { checkOneConference } from "@/lib/conference-refresh";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const result = await checkOneConference(event);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  await prisma.event.update({ where: { id }, data: { lastRefreshedAt: new Date() } });
  return NextResponse.json({ suggestion: result.suggestion });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
