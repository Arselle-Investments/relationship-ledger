import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractContactFromMessage } from "@/lib/ai";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { inboundMessageSchema } from "@/lib/correspondence-schema";
import { isStaffEmail } from "@/lib/staff-emails";
import { extractEmailFromText } from "@/lib/email-extract";
import { findContactByNameFallback, findContactBySubjectFallback } from "@/lib/contact-match";
import { findEmergingManagerMatch } from "@/lib/em-match";
import { CorrespondenceStatus } from "@prisma/client";

/**
 * Receives one message forwarded from the Fundraising Teams channel (via a
 * Power Automate flow, not a direct Microsoft Graph integration — this avoids
 * needing a Graph API permission grant beyond what SSO already requires).
 * Authenticated by a shared secret header rather than a user session, since
 * the caller is an automation, not a signed-in person.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TEAMS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inboundMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.messageId) {
    const existing = await prisma.correspondence.findUnique({ where: { externalId: data.messageId } });
    if (existing) return NextResponse.json({ correspondence: existing, deduped: true });
  }

  let extracted: { name: string | null; email: string | null; org: string | null } = {
    name: null,
    email: null,
    org: null,
  };
  try {
    extracted = await extractContactFromMessage(data.subject ?? "", data.bodyText);
  } catch (e) {
    // An AI outage (rate limit, exhausted credits) shouldn't drop the message —
    // fall back to whatever the subject-line matcher below can find on its own.
    console.error("AI contact extraction failed, falling back to subject-only matching", e);
  }
  // A message that's genuinely internal-only (a teammate's note about a call,
  // no external party actually on the thread) can lead the model to return
  // the internal author since there's nothing external to find — never treat
  // one of our own team as "the contact."
  if (isStaffEmail(extracted.email)) {
    extracted.email = null;
    extracted.name = null;
  }
  // The model sometimes finds a name but misses the email even when one's
  // sitting right in the message (a signature block, a quoted reply) — a
  // plain regex scan catches those cases the AI extraction didn't.
  if (!extracted.email) {
    extracted.email = extractEmailFromText(data.bodyText);
  }

  let contactId: string | null = null;
  if (extracted.email) {
    const match = await prisma.contact.findFirst({
      where: { email: { equals: extracted.email, mode: "insensitive" } },
    });
    if (match) contactId = match.id;
  }
  if (!contactId && extracted.name) {
    contactId = await findContactByNameFallback(extracted.name);
  }
  if (!contactId) {
    contactId = await findContactBySubjectFallback(data.subject ?? null);
  }

  // Not every message on the Fundraising channel is about an LP — some are
  // about an Emerging Managers gatekeeper (a consultant or capital source)
  // instead. Only checked once no Contact matched, since a person on a
  // thread always takes priority over the org they work for.
  let consultantId: string | null = null;
  let capitalSourceId: string | null = null;
  if (!contactId) {
    const emMatch = await findEmergingManagerMatch(extracted.org, data.subject ?? null);
    if (emMatch && "consultantId" in emMatch) consultantId = emMatch.consultantId;
    else if (emMatch && "capitalSourceId" in emMatch) capitalSourceId = emMatch.capitalSourceId;
  }

  const matchedId = contactId || consultantId || capitalSourceId;
  const correspondence = await prisma.correspondence.create({
    data: {
      source: "teams_channel",
      externalId: data.messageId || null,
      subject: data.subject || null,
      bodyText: data.bodyText,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
      contactId,
      consultantId,
      capitalSourceId,
      extractedName: extracted.name,
      extractedEmail: extracted.email,
      extractedOrg: extracted.org,
      status: matchedId ? CorrespondenceStatus.MATCHED : CorrespondenceStatus.SUGGESTED,
    },
  });

  let finalCorrespondence = correspondence;
  if (matchedId) {
    const updated = await maybeCreateStageSuggestion({
      correspondenceId: correspondence.id,
      contactId,
      consultantId,
      capitalSourceId,
      subject: data.subject ?? "",
      bodyText: data.bodyText,
    });
    if (updated) finalCorrespondence = updated;
  }

  return NextResponse.json({ correspondence: finalCorrespondence }, { status: 201 });
}
