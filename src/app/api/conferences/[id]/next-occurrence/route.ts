import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { checkOneConference } from "@/lib/conference-refresh";

function addOneYear(d: Date): Date {
  const next = new Date(d);
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

/**
 * Spins up next year's occurrence of a recurring conference: carries forward
 * the stable facts (name, location, type, organizer, tier, registration link,
 * fit note), resets the year-specific ones (dates shift a year, registration
 * status/attendance/goals/notes start fresh), and — since nothing here has
 * been hand-edited yet — immediately tries the existing registration link to
 * see if it already reflects the new year, applying whatever it finds
 * directly rather than leaving it as a suggestion to confirm.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const source = await prisma.conference.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Conference not found." }, { status: 404 });

  const seriesId = source.seriesId ?? source.id;
  if (!source.seriesId) {
    await prisma.conference.update({ where: { id: source.id }, data: { seriesId } });
  }

  let next = await prisma.conference.create({
    data: {
      name: source.name,
      startDate: addOneYear(source.startDate),
      endDate: addOneYear(source.endDate),
      location: source.location,
      type: source.type,
      goals: "",
      notes: "",
      attendeeIds: [],
      tier: source.tier,
      organizer: source.organizer,
      registrationLink: source.registrationLink,
      registrationStatus: source.registrationLink ? "Not yet open" : null,
      dateConfidence: "Estimate: based on last year's date",
      fitNote: source.fitNote,
      seriesId,
    },
  });

  let refreshNote: string | null = null;
  if (next.registrationLink) {
    const result = await checkOneConference(next);
    if (result.ok) {
      const s = result.suggestion;
      next = await prisma.conference.update({
        where: { id: next.id },
        data: {
          ...(s.startDate ? { startDate: new Date(s.startDate) } : {}),
          ...(s.endDate ? { endDate: new Date(s.endDate) } : {}),
          ...(s.location ? { location: s.location } : {}),
          ...(s.registrationStatus ? { registrationStatus: s.registrationStatus } : {}),
          ...(s.registrationLink ? { registrationLink: s.registrationLink } : {}),
          ...(s.registrationOpensAt ? { registrationOpensAt: new Date(s.registrationOpensAt) } : {}),
          ...(s.dateConfidence ? { dateConfidence: s.dateConfidence } : {}),
          ...(s.fitNote ? { fitNote: s.fitNote } : {}),
          lastRefreshedAt: new Date(),
        },
      });
      refreshNote = s.summary;
    } else {
      refreshNote = result.error;
    }
  }

  return NextResponse.json({ conference: next, refreshNote });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
