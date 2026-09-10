import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { safeCell } from "@/lib/excel-safety";

// The same fields "Import from Agora" deliberately leaves alone (see
// verify-against-agora), plus tags — the only channel a CRM mailing list has
// into Agora (see src/lib/list-tagging.ts), so a tag change is exactly the
// kind of thing this export needs to carry over too.
const FIELDS = ["org", "phone", "city", "notes", "tags"] as const;
type FieldKey = (typeof FIELDS)[number];
const FIELD_LABELS: Record<FieldKey, string> = {
  org: "Organization",
  phone: "Phone",
  city: "City",
  notes: "Notes",
  tags: "Tags",
};

/**
 * Companion to export-new-for-agora, for contacts Agora *already* knows
 * about (agoraExportedAt set) whose org/phone/city/notes have since changed
 * here — using the Edit Log rather than re-diffing against a file, so this
 * needs no fresh Agora export to run against. Only ever reports what changed
 * and its current value; nothing is written back to Agora automatically.
 * Marks each included contact's agoraChangesSyncedAt so re-running only
 * picks up what's changed since this run.
 */
export async function POST() {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const candidates = await prisma.contact.findMany({
    where: { agoraExportedAt: { not: null } },
    select: { id: true, name: true, email: true, org: true, phone: true, city: true, notes: true, tags: true, agoraChangesSyncedAt: true },
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

  const changedFieldsByContact = new Map<string, Set<FieldKey>>();
  for (const entry of entries) {
    const contact = candidates.find((c) => c.id === entry.entityId);
    if (!contact) continue;
    const since = contact.agoraChangesSyncedAt;
    if (since && entry.createdAt <= since) continue;
    if (!changedFieldsByContact.has(contact.id)) changedFieldsByContact.set(contact.id, new Set());
    changedFieldsByContact.get(contact.id)!.add(entry.field as FieldKey);
  }

  const toExport = candidates.filter((c) => (changedFieldsByContact.get(c.id)?.size ?? 0) > 0);
  if (toExport.length === 0) {
    return NextResponse.json({ error: "No contact changes since the last export." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Contact Changes");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 26 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "City", key: "city", width: 18 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Tags", key: "tags", width: 30 },
    { header: "Changed Fields", key: "changedFields", width: 26 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const c of toExport) {
    const changed = changedFieldsByContact.get(c.id)!;
    sheet.addRow({
      name: safeCell(c.name),
      email: safeCell(c.email ?? ""),
      org: safeCell(c.org ?? ""),
      phone: safeCell(c.phone ?? ""),
      city: safeCell(c.city ?? ""),
      notes: safeCell(c.notes ?? ""),
      tags: safeCell((c.tags ?? []).join(", ")),
      changedFields: Array.from(changed).map((f) => FIELD_LABELS[f]).join(", "),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  await prisma.contact.updateMany({
    where: { id: { in: toExport.map((c) => c.id) } },
    data: { agoraChangesSyncedAt: new Date() },
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-contact-changes-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
