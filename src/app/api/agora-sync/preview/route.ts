import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { agoraSyncState, isExportableToAgora } from "@/lib/agora-sync";

/**
 * Who would be in each Agora export, for the Agora Sync page's "preview":
 * kind=new (never sent), changed (touched since last sent), or all (every
 * contact with a real email). Read-only — never stamps sync markers.
 */
export async function GET(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "new" && kind !== "changed" && kind !== "all") {
    return NextResponse.json({ error: "kind must be new, changed, or all." }, { status: 400 });
  }

  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      org: true,
      status: true,
      recordContexts: true,
      doNotContact: true,
      updatedAt: true,
      agoraExportedAt: true,
      agoraChangesSyncedAt: true,
    },
    orderBy: { name: "asc" },
  });

  const rows = contacts
    .filter((c) => (kind === "all" ? isExportableToAgora(c) : agoraSyncState(c) === kind))
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      org: c.org,
      status: c.status,
      recordContexts: c.recordContexts,
      doNotContact: c.doNotContact,
      updatedAt: c.updatedAt,
      lastSent: c.agoraChangesSyncedAt ?? c.agoraExportedAt,
      heldBack: !isExportableToAgora(c),
    }));

  return NextResponse.json({ rows });
}
