import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatAssignees } from "@/lib/task-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const assigneeId = searchParams.get("assigneeId");

  const [tasks, team] = await Promise.all([
    prisma.task.findMany({
      where: assigneeId ? { assigneeIds: { has: assigneeId } } : undefined,
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany(),
  ]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tasks");
  sheet.columns = [
    { header: "Title", key: "title", width: 30 },
    { header: "Related Contact", key: "contact", width: 24 },
    { header: "Assigned To", key: "owner", width: 28 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const t of tasks) {
    sheet.addRow({
      title: safeCell(t.title),
      contact: safeCell(t.contact?.name ?? ""),
      owner: safeCell(formatAssignees(t.assigneeIds, team)),
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
      status: TASK_STATUS_LABELS[t.status],
      priority: TASK_PRIORITY_LABELS[t.priority],
      notes: safeCell(t.notes ?? ""),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-tasks-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
