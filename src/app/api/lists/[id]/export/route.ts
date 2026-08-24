import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { computeListContacts } from "@/lib/mailing-lists";
import { CONTACT_STATUS_LABELS, CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const list = await prisma.mailingList.findUnique({ where: { id } });
  if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });
  const contacts = await computeListContacts(list);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(list.name.slice(0, 31) || "List");
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
      name: c.name,
      org: c.org ?? "",
      type: CONTACT_TYPE_LABELS[c.type],
      tier: CONTACT_TIER_LABELS[c.tier],
      status: CONTACT_STATUS_LABELS[c.status],
      owner: c.owner?.name ?? "",
      email: c.email ?? "",
      tags: (c.tags ?? []).join(", "),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = list.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "mailing-list";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
    },
  });
}
