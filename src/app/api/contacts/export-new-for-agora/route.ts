import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { CONTACT_STATUS_LABELS, CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

/**
 * Exports every contact added here since the last time this ran (whether
 * created manually or confirmed from the Inbox), for hand-import into Agora
 * to keep it the source of truth. Marks them exported so re-running this
 * later only ever picks up what's genuinely new — never re-sends the same
 * contact twice. Column headers are a placeholder using our own field names;
 * expect to adjust these once we see Agora's actual expected import format.
 */
export async function POST() {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const contacts = await prisma.contact.findMany({
    where: { agoraExportedAt: null },
    include: { owner: true, warmPath: true },
    orderBy: { createdAt: "asc" },
  });

  if (contacts.length === 0) {
    return NextResponse.json({ error: "No new contacts since the last Agora export." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("New Contacts");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Type", key: "type", width: 18 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Status", key: "status", width: 18 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Email", key: "email", width: 26 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "City", key: "city", width: 18 },
    { header: "Tags", key: "tags", width: 24 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Added to Ledger", key: "createdAt", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const c of contacts) {
    sheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      type: CONTACT_TYPE_LABELS[c.type],
      tier: CONTACT_TIER_LABELS[c.tier],
      status: CONTACT_STATUS_LABELS[c.status],
      owner: safeCell(c.owner?.name ?? ""),
      email: safeCell(c.email ?? ""),
      phone: safeCell(c.phone ?? ""),
      city: safeCell(c.city ?? ""),
      tags: safeCell((c.tags ?? []).join(", ")),
      notes: safeCell(c.notes ?? ""),
      createdAt: c.createdAt.toISOString().slice(0, 10),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  await prisma.contact.updateMany({
    where: { id: { in: contacts.map((c) => c.id) } },
    data: { agoraExportedAt: new Date() },
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-new-contacts-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
