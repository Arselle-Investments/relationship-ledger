import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { parseFirstSheet } from "@/lib/excel-import";
import { buildAgoraContact } from "@/lib/agora-import";
import { DEV_TEAM } from "@/lib/dev-team";
import { Role } from "@prisma/client";

/**
 * Replaces the entire contact roster with a fresh Agora export. This is
 * intentionally a full replace, not an upsert: Agora is the system of record
 * for who our contacts are, and re-running this is how the team keeps the
 * ledger in sync after a new pull (removed contacts should actually
 * disappear here too, matching the same "replace, don't merge" approach
 * already used for the conference tracker import).
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const rows = await parseFirstSheet(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found in that file." }, { status: 400 });
  }

  // Real sign-in (Entra ID) isn't wired up yet, so a team member only has a
  // User row once they've used the dev-login bypass at least once — which
  // means "Staff Members" matching would silently only ever work for
  // whoever happened to have logged in already. Make sure the known team
  // roster exists so ownership actually gets assigned as expected.
  await Promise.all(
    DEV_TEAM.map((m) =>
      prisma.user.upsert({
        where: { email: m.email },
        update: {},
        create: { email: m.email, name: m.name, role: Role.VIEWER },
      })
    )
  );

  const users = await prisma.user.findMany();
  const userByName = new Map(users.map((u) => [(u.name ?? "").toLowerCase(), u]));

  let skipped = 0;
  const contactsData = [];
  for (const row of rows) {
    const built = buildAgoraContact(row, userByName);
    if (!built) {
      skipped++;
      continue;
    }
    contactsData.push(built);
  }

  if (contactsData.length === 0) {
    return NextResponse.json({ error: "No contacts with a name were found in that file." }, { status: 400 });
  }

  // These contacts are coming straight from Agora, so they're already
  // current there by definition — mark them as exported so "Export new for
  // Agora" only ever surfaces contacts that originated on our side (e.g.
  // confirmed from a Teams message) and haven't made it back into Agora yet.
  const importedAt = new Date();
  const contactsToCreate = contactsData.map((c) => ({ ...c, agoraExportedAt: importedAt }));

  await prisma.$transaction([
    prisma.contact.deleteMany({}),
    prisma.contact.createMany({ data: contactsToCreate }),
  ]);

  // Static mailing lists can only reference contacts that still exist —
  // every old id is gone now, so drop them rather than leave dead references.
  const lists = await prisma.mailingList.findMany({ where: { mode: "STATIC" } });
  await Promise.all(
    lists
      .filter((l) => l.contactIds.length > 0)
      .map((l) => prisma.mailingList.update({ where: { id: l.id }, data: { contactIds: [] } }))
  );

  return NextResponse.json({
    imported: contactsData.length,
    skipped,
    listsCleared: lists.filter((l) => l.contactIds.length > 0).length,
  });
}
