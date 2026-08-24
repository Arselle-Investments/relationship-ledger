import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { getOverdueContacts, getStaleContacts } from "@/lib/followups";
import { getOverdueSequenceContacts } from "@/lib/sequences";
import { getSettings } from "@/lib/settings";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-constants";
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
  const overdue = getOverdueContacts(contacts, settings.defaultCadenceDays);
  const stale = getStaleContacts(contacts, settings.staleDays);
  const overdueSequences = getOverdueSequenceContacts(contacts);

  const workbook = new ExcelJS.Workbook();

  const overdueSheet = workbook.addWorksheet("Overdue by cadence");
  overdueSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Status", key: "status", width: 18 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Days Overdue", key: "daysOverdue", width: 14 },
    { header: "Cadence (days)", key: "cadence", width: 14 },
  ];
  overdueSheet.getRow(1).font = { bold: true };
  for (const c of overdue) {
    overdueSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      status: CONTACT_STATUS_LABELS[c.status],
      owner: safeCell(c.owner?.name ?? ""),
      daysOverdue: c.daysOverdue,
      cadence: c.cadence,
    });
  }

  const seqSheet = workbook.addWorksheet("Overdue sequence steps");
  seqSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Sequence Step", key: "step", width: 26 },
    { header: "Due Date", key: "due", width: 14 },
  ];
  seqSheet.getRow(1).font = { bold: true };
  for (const c of overdueSequences) {
    seqSheet.addRow({ name: safeCell(c.name), org: safeCell(c.org ?? ""), step: safeCell(c.step.title), due: c.step.dueDate });
  }

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
      reasons: c.staleReasons.join(", "),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-followups-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
