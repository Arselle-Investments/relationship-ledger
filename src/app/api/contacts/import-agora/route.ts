import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { parseFirstSheet } from "@/lib/excel-import";
import { buildAgoraContact } from "@/lib/agora-import";
import { DEV_TEAM } from "@/lib/dev-team";
import { Role } from "@prisma/client";

/**
 * Non-destructive Agora sync: matches each row against an existing contact
 * by email and either creates a new one or refreshes it — never deletes
 * anything. This is the everyday "a handful of new entries showed up in
 * Agora" path.
 *
 * On a match, only fields with no editable form in the app are refreshed
 * (Agora type, primary location, staff, commitment range, email tier, the
 * full raw row) plus a tag merge — org/email/phone/city/notes are left
 * alone since a team member may have deliberately corrected or enriched
 * them locally, and re-running this shouldn't silently overwrite that. Owner
 * is only set if the contact doesn't already have one. For a full refresh of
 * every field (e.g. the very first bulk load), use the admin-only
 * "replace all" import in Settings instead.
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

  // Same rationale as the replace-all import: make sure the known team
  // roster exists so "Staff Members" matching can actually assign an owner.
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

  const existingContacts = await prisma.contact.findMany({ where: { email: { not: null } } });
  const existingByEmail = new Map(existingContacts.map((c) => [c.email!.toLowerCase(), c]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const importedAt = new Date();

  for (const row of rows) {
    const built = buildAgoraContact(row, userByName);
    if (!built) {
      skipped++;
      continue;
    }

    const existing = built.email ? existingByEmail.get(built.email.toLowerCase()) : undefined;

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          agoraType: built.agoraType,
          primaryLocation: built.primaryLocation,
          staffNames: built.staffNames,
          commitmentLow: built.commitmentLow,
          commitmentHigh: built.commitmentHigh,
          emailTier: built.emailTier,
          agoraRaw: built.agoraRaw,
          tags: Array.from(new Set([...(existing.tags ?? []), ...built.tags])),
          ownerId: existing.ownerId ?? built.ownerId,
        },
      });
      updated++;
    } else {
      await prisma.contact.create({
        data: { ...built, agoraExportedAt: importedAt },
      });
      created++;
    }
  }

  return NextResponse.json({ created, updated, skipped });
}
