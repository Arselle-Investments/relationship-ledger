import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { getField, normalizeDate, parseAllSheets } from "@/lib/excel-import";
import { inferConferenceType } from "@/lib/conference-constants";

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const rows = await parseAllSheets(buffer);

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = getField(row, ["EVENT NAME", "NAME", "EVENT"]);
    const startDate = normalizeDate(getField(row, ["START DATE", "START", "DATE"]));
    if (!name || !startDate) {
      skipped++;
      continue;
    }
    const endDate = normalizeDate(getField(row, ["END DATE", "END"])) || startDate;
    const location = getField(row, ["EVENT LOCATION/ADDRESS", "LOCATION", "ADDRESS"]);
    const link = getField(row, ["LINK"]);
    const duration = getField(row, ["EVENT TIME DURATION", "TIME DURATION", "DURATION"]);
    const registration = getField(row, ["REGISTRATION", "REGISTRATION OPEN", "REGISTRATION STATUS"]);
    const deadline = getField(row, ["REGISTRATION DEADLINE"]);
    const costs = getField(row, ["COSTS", "COST"]);
    const noteParts: string[] = [];
    if (registration) noteParts.push(`Registration: ${registration}`);
    if (deadline) noteParts.push(`Deadline: ${deadline}`);
    if (costs) noteParts.push(`Costs: ${costs}`);
    if (duration) noteParts.push(`Time: ${duration}`);
    if (link) noteParts.push(`Ref: ${link}`);
    const notes = noteParts.join(" · ");

    const existing = await prisma.conference.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        startDate: new Date(startDate),
      },
    });

    if (existing) {
      await prisma.conference.update({
        where: { id: existing.id },
        data: {
          endDate: new Date(endDate),
          location: location || existing.location,
          notes: notes || existing.notes,
        },
      });
      updated++;
    } else {
      await prisma.conference.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          location: location || null,
          type: inferConferenceType(name),
          attendeeIds: [],
          goals: "",
          notes,
        },
      });
      added++;
    }
  }

  return NextResponse.json({ added, updated, skipped });
}
