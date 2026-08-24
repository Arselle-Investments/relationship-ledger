import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { quarterBounds, eventInQuarter } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";
import { safeCell } from "@/lib/excel-safety";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter");

  const [allEvents, team] = await Promise.all([
    prisma.event.findMany({ orderBy: { startDate: "asc" } }),
    prisma.user.findMany(),
  ]);
  const teamById = new Map(team.map((u) => [u.id, u.name || u.email]));
  const events = filter === "quarter" ? allEvents.filter((ev) => eventInQuarter(ev, quarterBounds(0))) : allEvents;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Events");
  sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "End Date", key: "endDate", width: 14 },
    { header: "Location", key: "location", width: 24 },
    { header: "Type", key: "type", width: 16 },
    { header: "Attendees", key: "attendees", width: 30 },
    { header: "Goals", key: "goals", width: 30 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const ev of events) {
    sheet.addRow({
      name: safeCell(ev.name),
      startDate: ev.startDate.toISOString().slice(0, 10),
      endDate: ev.endDate.toISOString().slice(0, 10),
      location: safeCell(ev.location ?? ""),
      type: EVENT_TYPE_LABELS[ev.type],
      attendees: safeCell(ev.attendeeIds.map((id) => teamById.get(id) ?? "").join(", ")),
      goals: safeCell(ev.goals ?? ""),
      notes: safeCell(ev.notes ?? ""),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-events-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
