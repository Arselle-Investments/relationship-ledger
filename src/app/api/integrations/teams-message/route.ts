import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractContactFromMessage } from "@/lib/ai";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { inboundMessageSchema } from "@/lib/correspondence-schema";
import { isStaffEmail } from "@/lib/staff-emails";
import { findContactByNameFallback, findContactBySubjectFallback } from "@/lib/contact-match";
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

  const correspondence = await prisma.correspondence.create({
    data: {
      source: "teams_channel",
      externalId: data.messageId || null,
      subject: data.subject || null,
      bodyText: data.bodyText,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
      contactId,
      extractedName: extracted.name,
      extractedEmail: extracted.email,
      extractedOrg: extracted.org,
      status: contactId ? CorrespondenceStatus.MATCHED : CorrespondenceStatus.SUGGESTED,
    },
  });

  let finalCorrespondence = correspondence;
  if (contactId) {
    const updated = await maybeCreateStageSuggestion({
      correspondenceId: correspondence.id,
      contactId,
      subject: data.subject ?? "",
      bodyText: data.bodyText,
    });
    if (updated) finalCorrespondence = updated;
  }

  return NextResponse.json({ correspondence: finalCorrespondence }, { status: 201 });
}
