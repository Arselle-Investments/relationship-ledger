import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";

/** History of every Agora export actually downloaded, newest first — lets the
 * team see who exported what and when, and redownload the exact file later
 * to double-check or compare against what's in Agora now. */
export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const logs = await prisma.agoraExportLog.findMany({
    select: {
      id: true,
      kind: true,
      fileName: true,
      recordCount: true,
      skippedCount: true,
      createdByName: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ logs });
}
