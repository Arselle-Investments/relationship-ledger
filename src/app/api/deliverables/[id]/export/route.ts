import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { computeDeliverableContacts } from "@/lib/deliverables";
import { FUNDRAISING_STAGE_LABELS, CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const deliverable = await prisma.deliverable.findUnique({ where: { id } });
  if (!deliverable) return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });
  const allContacts = await prisma.contact.findMany({ include: { owner: true, warmPath: true } });
  const contacts = computeDeliverableContacts(deliverable, allContacts);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(deliverable.name.slice(0, 31) || "Deliverable");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Type", key: "type", width: 18 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Status", key: "status", width: 18 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Email", key: "email", width: 26 },
    { header: "Tags", key: "tags", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const c of contacts) {
    sheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      type: CONTACT_TYPE_LABELS[c.type],
      tier: CONTACT_TIER_LABELS[c.tier],
      status: FUNDRAISING_STAGE_LABELS[c.status],
      owner: safeCell(c.owner?.name ?? ""),
      email: safeCell(c.email ?? ""),
      tags: safeCell((c.tags ?? []).join(", ")),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = deliverable.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "deliverable";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
    },
  });
}
