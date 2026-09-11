import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";

/** Redownloads the exact file from a past Agora export — the stored bytes,
 * not a freshly regenerated copy, so it's still a faithful record of what
 * was actually sent even if the underlying contacts have changed since. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const log = await prisma.agoraExportLog.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: "Export not found." }, { status: 404 });

  return new NextResponse(Buffer.from(log.fileData), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${log.fileName}"`,
    },
  });
}
