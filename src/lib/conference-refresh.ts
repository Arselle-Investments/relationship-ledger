import { Conference } from "@prisma/client";
import { refreshConferenceInfo, ConferenceRefreshResult } from "@/lib/ai";

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ConferenceCheckResult = { ok: true; suggestion: ConferenceRefreshResult } | { ok: false; error: string };

/**
 * Fetches one conference's registration page, strips it to text, and asks the AI
 * what's new or changed versus what's on file. Shared by the single-conference
 * refresh route and the bulk "refresh all" route so both fetch/parse/extract
 * exactly the same way.
 */
export async function checkOneConference(conference: Conference): Promise<ConferenceCheckResult> {
  if (!conference.registrationLink) {
    return { ok: false, error: "No registration link on file to check." };
  }
  const url = /^https?:\/\//i.test(conference.registrationLink) ? conference.registrationLink : `https://${conference.registrationLink}`;

  let pageText: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const pageRes = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArselleLedger/1.0)" },
    });
    clearTimeout(timeout);
    if (!pageRes.ok) {
      return { ok: false, error: `Couldn't load the registration page (status ${pageRes.status}).` };
    }
    pageText = stripHtmlToText(await pageRes.text());
  } catch {
    return { ok: false, error: "Couldn't reach the registration page. It may be down or blocking automated requests." };
  }

  if (!pageText) {
    return { ok: false, error: "The registration page loaded but had no readable text content." };
  }

  try {
    const suggestion = await refreshConferenceInfo({
      conferenceName: conference.name,
      currentStartDate: isoDate(conference.startDate),
      currentEndDate: isoDate(conference.endDate),
      currentLocation: conference.location,
      currentRegistrationStatus: conference.registrationStatus,
      pageUrl: url,
      pageText,
    });
    return { ok: true, suggestion };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "AI check failed — try again in a bit." };
  }
}

export function conferenceSuggestionHasAnything(s: ConferenceRefreshResult): boolean {
  return Boolean(
    s.startDate || s.endDate || s.location || s.registrationStatus || s.registrationLink || s.registrationOpensAt || s.dateConfidence || s.fitNote || s.summary
  );
}
