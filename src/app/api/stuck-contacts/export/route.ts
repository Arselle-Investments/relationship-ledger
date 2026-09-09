import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { AuthError, requireUser } from "@/lib/permissions";
import { getStuckContacts } from "@/lib/stuck-contacts";
import { getSettings } from "@/lib/settings";
import { draftCheckInEmail } from "@/lib/ai";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const settings = await getSettings();
  const stuck = await getStuckContacts(settings.stuckDays);

  const drafts = await Promise.all(
    stuck.map((c) =>
      draftCheckInEmail({ name: c.name, org: c.org, status: c.status, daysInStage: c.daysInStage, notes: c.notes })
    )
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stuck Contacts");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Stage", key: "stage", width: 18 },
    { header: "Days in Stage", key: "days", width: 14 },
    { header: "Suggested Check-in", key: "draft", width: 60 },
  ];
  sheet.getRow(1).font = { bold: true };
  stuck.forEach((c, i) => {
    sheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      stage: FUNDRAISING_STAGE_LABELS[c.status],
      days: c.daysInStage,
      draft: safeCell(drafts[i]),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-stuck-contacts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
