import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { CorrespondenceStatus } from "@prisma/client";

const ALLOWED_STATUSES = new Set([CorrespondenceStatus.IGNORED, CorrespondenceStatus.SUGGESTED]);

/**
 * Dismiss a suggested correspondence entry (it stays for the record, just no
 * longer actionable), or undo that and put it back as a suggestion — e.g. an
 * "ignore" clicked by mistake.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Only dismissing (IGNORED) or undoing (SUGGESTED) is supported here." }, { status: 400 });
  }
  const correspondence = await prisma.correspondence.update({
    where: { id },
    data: { status: body.status },
  });
  return NextResponse.json({ correspondence });
}
