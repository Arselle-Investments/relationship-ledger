import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { AGORA_TEMPLATE_HEADERS, buildAgoraContactRow } from "@/lib/agora-export-template";

// The same fields "Import from Agora" deliberately leaves alone (see
// verify-against-agora), plus tags — the only channel a CRM mailing list has
// into Agora (see src/lib/list-tagging.ts), so a tag change is exactly the
// kind of thing this export needs to carry over too.
const FIELDS = ["org", "phone", "city", "notes", "tags"] as const;
type FieldKey = (typeof FIELDS)[number];

/**
 * Companion to export-new-for-agora, for contacts Agora *already* knows
 * about (agoraExportedAt set) whose org/phone/city/notes/tags have since
 * changed here — using the Edit Log rather than re-diffing against a file,
 * so this needs no fresh Agora export to run against. Marks each included
 * contact's agoraChangesSyncedAt so re-running only picks up what's changed
 * since this run.
 *
 * Uses Agora's own contact template (same as export-new-for-agora), matched
 * on Email, and always fills every column with the contact's full current
 * data rather than just the changed field(s) — a blank cell in an update
 * import could plausibly mean either "leave this alone" or "clear this
 * field" depending on how Agora's importer treats it, and sending the real
 * current value everywhere is correct under either reading. Confirm with
 * Agora directly which it is before assuming a sparser file would be safe.
 */
export async function POST() {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const candidates = await prisma.contact.findMany({
    where: { agoraExportedAt: { not: null } },
    include: { company: true },
  });
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No contacts have been sent to Agora yet." }, { status: 400 });
  }

  const entries = await prisma.editLogEntry.findMany({
    where: {
      entityType: "Contact",
      entityId: { in: candidates.map((c) => c.id) },
      field: { in: FIELDS as unknown as string[] },
      undone: false,
    },
    orderBy: { createdAt: "asc" },
  });

  const changedSinceSync = new Set<string>();
  for (const entry of entries) {
    const contact = candidates.find((c) => c.id === entry.entityId);
    if (!contact) continue;
    const since = contact.agoraChangesSyncedAt;
    if (since && entry.createdAt <= since) continue;
    changedSinceSync.add(contact.id);
  }

  const toExport = candidates.filter((c) => changedSinceSync.has(c.id));
  if (toExport.length === 0) {
    return NextResponse.json({ error: "No contact changes since the last export." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");
  sheet.addRow([...AGORA_TEMPLATE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const c of toExport) {
    sheet.addRow(buildAgoraContactRow(c, c.company));
  }
  sheet.columns.forEach((col) => (col.width = 20));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const fileName = `arselle-contact-changes-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await prisma.$transaction([
    prisma.contact.updateMany({
      where: { id: { in: toExport.map((c) => c.id) } },
      data: { agoraChangesSyncedAt: new Date() },
    }),
    prisma.agoraExportLog.create({
      data: {
        kind: "contacts-changes",
        fileName,
        fileData: buffer,
        recordCount: toExport.length,
        createdById: actingUser.id,
        createdByName: actingUser.name,
      },
    }),
  ]);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
