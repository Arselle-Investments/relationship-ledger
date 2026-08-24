import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { getOverdueContacts } from "@/lib/followups";
import { getOverdueSequenceContacts, getUpcomingSequenceItems } from "@/lib/sequences";
import { getUpcomingCadenceContacts, windowBounds } from "@/lib/lookahead";
import { eventOverlapsWindow } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/task-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days") === "30" ? 30 : 14;

  const [contacts, tasks, events, settings] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    prisma.task.findMany({ include: { owner: true, contact: true } }),
    prisma.event.findMany(),
    getSettings(),
  ]);

  const bounds = windowBounds(days);
  const today = new Date().toISOString().slice(0, 10);

  const requiredCadence = getOverdueContacts(contacts, settings.defaultCadenceDays);
  const requiredSeq = getOverdueSequenceContacts(contacts);
  const recommendedSeq = getUpcomingSequenceItems(contacts, bounds.end);
  const recommendedCadence = getUpcomingCadenceContacts(contacts, settings.defaultCadenceDays, bounds.end);
  const milestones = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate.toISOString().slice(0, 10) <= bounds.end)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const conferences = events
    .filter((ev) => eventOverlapsWindow(ev, bounds))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const workbook = new ExcelJS.Workbook();

  const requiredSheet = workbook.addWorksheet("Required Follow-ups");
  requiredSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Issue", key: "issue", width: 40 },
  ];
  requiredSheet.getRow(1).font = { bold: true };
  for (const c of requiredCadence) {
    requiredSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      issue: `${c.daysOverdue + c.cadence}d overdue on cadence`,
    });
  }
  for (const c of requiredSeq) {
    requiredSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      issue: `Sequence step "${c.step.title}" due ${c.step.dueDate}`,
    });
  }

  const recommendedSheet = workbook.addWorksheet("Recommended Outreach");
  recommendedSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Detail", key: "detail", width: 40 },
  ];
  recommendedSheet.getRow(1).font = { bold: true };
  for (const r of recommendedSeq) {
    recommendedSheet.addRow({
      name: safeCell(r.name),
      org: safeCell(r.org ?? ""),
      owner: safeCell(r.owner?.name ?? ""),
      detail: `${r.step.title} due ${r.step.dueDate}`,
    });
  }
  for (const c of recommendedCadence) {
    recommendedSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      detail: `Cadence follow-up due by ${bounds.end}`,
    });
  }

  const milestonesSheet = workbook.addWorksheet("Milestones");
  milestonesSheet.columns = [
    { header: "Title", key: "title", width: 30 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Due Date", key: "due", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
  ];
  milestonesSheet.getRow(1).font = { bold: true };
  for (const t of milestones) {
    milestonesSheet.addRow({
      title: safeCell(t.title),
      owner: safeCell(t.owner?.name ?? ""),
      due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
      status: TASK_STATUS_LABELS[t.status],
      priority: TASK_PRIORITY_LABELS[t.priority],
    });
  }

  const eventsSheet = workbook.addWorksheet("Conferences");
  eventsSheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Start Date", key: "start", width: 14 },
    { header: "End Date", key: "end", width: 14 },
    { header: "Location", key: "location", width: 24 },
    { header: "Type", key: "type", width: 16 },
  ];
  eventsSheet.getRow(1).font = { bold: true };
  for (const ev of conferences) {
    eventsSheet.addRow({
      name: safeCell(ev.name),
      start: ev.startDate.toISOString().slice(0, 10),
      end: ev.endDate.toISOString().slice(0, 10),
      location: safeCell(ev.location ?? ""),
      type: EVENT_TYPE_LABELS[ev.type],
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-lookahead-${days}d-${today}.xlsx"`,
    },
  });
}
