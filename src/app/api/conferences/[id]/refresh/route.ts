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
  const conference = await prisma.conference.findUnique({ where: { id } });
  if (!conference) return NextResponse.json({ error: "Conference not found." }, { status: 404 });

  const result = await checkOneConference(conference);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  await prisma.conference.update({ where: { id }, data: { lastRefreshedAt: new Date() } });
  return NextResponse.json({ suggestion: result.suggestion });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
