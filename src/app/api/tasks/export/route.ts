import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/task-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");

  const tasks = await prisma.task.findMany({
    where: ownerId ? { ownerId } : undefined,
    include: { owner: true, contact: true },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tasks");
  sheet.columns = [
    { header: "Title", key: "title", width: 30 },
    { header: "Related Contact", key: "contact", width: 24 },
    { header: "Owner", key: "owner", width: 20 },
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
      owner: safeCell(t.owner?.name ?? ""),
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
