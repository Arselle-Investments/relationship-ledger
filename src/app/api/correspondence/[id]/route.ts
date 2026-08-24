import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { CorrespondenceStatus } from "@prisma/client";

/** Dismiss a suggested correspondence entry — it stays for the record, just no longer actionable. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.status !== CorrespondenceStatus.IGNORED) {
    return NextResponse.json({ error: "Only dismissing (IGNORED) is supported here." }, { status: 400 });
  }
  const correspondence = await prisma.correspondence.update({
    where: { id },
    data: { status: CorrespondenceStatus.IGNORED },
  });
  return NextResponse.json({ correspondence });
}
