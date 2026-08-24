import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractContactFromMessage } from "@/lib/ai";
import { inboundMessageSchema } from "@/lib/correspondence-schema";
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

  const extracted = await extractContactFromMessage(data.subject ?? "", data.bodyText);

  let contactId: string | null = null;
  if (extracted.email) {
    const match = await prisma.contact.findFirst({
      where: { email: { equals: extracted.email, mode: "insensitive" } },
    });
    if (match) contactId = match.id;
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

  return NextResponse.json({ correspondence }, { status: 201 });
}
