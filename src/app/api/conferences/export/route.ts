import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { quarterBounds, yearBounds, conferenceInQuarter, conferenceIsConfirmedWithRegistration } from "@/lib/conferences";
import { CONFERENCE_TYPE_LABELS } from "@/lib/conference-constants";
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

  const [allConferences, team] = await Promise.all([
    prisma.conference.findMany({ orderBy: { startDate: "asc" } }),
    prisma.user.findMany(),
  ]);
  const teamById = new Map(team.map((u) => [u.id, u.name || u.email]));
  const conferences =
    filter === "quarter"
      ? allConferences.filter((ev) => conferenceInQuarter(ev, quarterBounds(0)))
      : filter === "year"
        ? allConferences.filter((ev) => conferenceInQuarter(ev, yearBounds(0)))
        : filter === "confirmed"
          ? allConferences.filter(conferenceIsConfirmedWithRegistration)
          : allConferences;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Conferences");
  sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "End Date", key: "endDate", width: 14 },
    { header: "Location", key: "location", width: 24 },
    { header: "Type", key: "type", width: 16 },
    { header: "Attendees", key: "attendees", width: 30 },
    { header: "Registration Status", key: "registrationStatus", width: 22 },
    { header: "Registration Link", key: "registrationLink", width: 30 },
    { header: "Goals", key: "goals", width: 30 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const ev of conferences) {
    sheet.addRow({
      name: safeCell(ev.name),
      startDate: ev.startDate.toISOString().slice(0, 10),
      endDate: ev.endDate.toISOString().slice(0, 10),
      location: safeCell(ev.location ?? ""),
      type: CONFERENCE_TYPE_LABELS[ev.type],
      attendees: safeCell(ev.attendeeIds.map((id) => teamById.get(id) ?? "").join(", ")),
      registrationStatus: safeCell(ev.registrationStatus ?? ""),
      registrationLink: safeCell(ev.registrationLink ?? ""),
      goals: safeCell(ev.goals ?? ""),
      notes: safeCell(ev.notes ?? ""),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-conferences-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
