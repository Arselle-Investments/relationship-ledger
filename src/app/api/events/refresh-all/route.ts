import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { checkOneConference, conferenceSuggestionHasAnything } from "@/lib/conference-refresh";
import { ConferenceRefreshResult } from "@/lib/ai";

const CONCURRENCY = 3;

export type BulkRefreshResultItem = {
  eventId: string;
  eventName: string;
  suggestion: ConferenceRefreshResult | null;
  error: string | null;
};

export async function POST(_req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const events = await prisma.event.findMany({
    where: { registrationLink: { not: null } },
    orderBy: { startDate: "asc" },
  });

  const results: BulkRefreshResultItem[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < events.length) {
      const event = events[cursor];
      cursor += 1;
      const result = await checkOneConference(event);
      await prisma.event.update({ where: { id: event.id }, data: { lastRefreshedAt: new Date() } });
      results.push({
        eventId: event.id,
        eventName: event.name,
        suggestion: result.ok ? result.suggestion : null,
        error: result.ok ? null : result.error,
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, events.length) }, () => worker()));

  const withUpdates = results.filter((r) => r.suggestion && conferenceSuggestionHasAnything(r.suggestion));
  const failed = results.filter((r) => r.error);

  return NextResponse.json({
    checked: results.length,
    withUpdates,
    failedCount: failed.length,
    failed: failed.map((f) => ({ eventId: f.eventId, eventName: f.eventName, error: f.error })),
  });
}
