import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { buildConferenceIcs } from "@/lib/ics";

// Hands back a plain .ics file — every mainstream calendar app (Outlook,
// Google Calendar, Apple Calendar) knows how to import one on double-click or
// "Add to calendar." No Microsoft Graph/OAuth calendar scope needed for this;
// see the Dev Guide for why a live push isn't wired up instead.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const idsParam = searchParams.get("ids");

  const [allConferences, team] = await Promise.all([
    prisma.conference.findMany({ orderBy: { startDate: "asc" } }),
    prisma.user.findMany(),
  ]);

  let conferences = allConferences;
  if (filter === "attending") {
    conferences = allConferences.filter((ev) => ev.attendeeIds.includes(user.id));
  } else if (filter === "ids") {
    const ids = new Set((idsParam ?? "").split(",").filter(Boolean));
    conferences = allConferences.filter((ev) => ids.has(ev.id));
  }

  if (conferences.length === 0) {
    return NextResponse.json({ error: "No conferences match that selection." }, { status: 400 });
  }

  const teamNameById = new Map(team.map((u) => [u.id, u.name || u.email || ""]));
  const ics = buildConferenceIcs(conferences, teamNameById);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="arselle-conferences-${new Date().toISOString().slice(0, 10)}.ics"`,
    },
  });
}
