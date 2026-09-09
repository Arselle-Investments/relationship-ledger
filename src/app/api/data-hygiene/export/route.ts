import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { getStaleContacts } from "@/lib/followups";
import { getSettings } from "@/lib/settings";
import { safeCell } from "@/lib/excel-safety";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [contacts, settings] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    getSettings(),
  ]);
  const stale = getStaleContacts(contacts, settings.staleDays);

  const workbook = new ExcelJS.Workbook();
  const staleSheet = workbook.addWorksheet("Data hygiene flags");
  staleSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Why Flagged", key: "reasons", width: 40 },
  ];
  staleSheet.getRow(1).font = { bold: true };
  for (const c of stale) {
    staleSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      reasons: c.staleReasons.map((r) => r.label).join(", "),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-data-hygiene-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
