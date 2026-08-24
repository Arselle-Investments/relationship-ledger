import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { buildContactWhere } from "@/lib/contact-query";
import { CONTACT_STATUS_LABELS, CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const where = buildContactWhere(searchParams);

  const contacts = await prisma.contact.findMany({
    where,
    include: { owner: true, warmPath: true },
    orderBy: { name: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Contacts");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Type", key: "type", width: 18 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Status", key: "status", width: 18 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Warm Path", key: "warmPath", width: 20 },
    { header: "Email", key: "email", width: 26 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "City", key: "city", width: 18 },
    { header: "Last Contact", key: "lastContact", width: 14 },
    { header: "Cadence Override (days)", key: "cadenceOverrideDays", width: 14 },
    { header: "Priority Quarter", key: "priorityQuarter", width: 14 },
    { header: "Tags", key: "tags", width: 24 },
    { header: "Notes", key: "notes", width: 40 },
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
      warmPath: safeCell(c.warmPath?.name ?? ""),
      email: safeCell(c.email ?? ""),
      phone: safeCell(c.phone ?? ""),
      city: safeCell(c.city ?? ""),
      lastContact: c.lastContact ? c.lastContact.toISOString().slice(0, 10) : "",
      cadenceOverrideDays: c.cadenceOverrideDays ?? "",
      priorityQuarter: safeCell(c.priorityQuarter ?? ""),
      tags: safeCell((c.tags ?? []).join(", ")),
      notes: safeCell(c.notes ?? ""),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-contacts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
