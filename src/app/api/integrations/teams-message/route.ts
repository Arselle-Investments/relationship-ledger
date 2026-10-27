import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractContactFromMessage } from "@/lib/ai";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { inboundMessageSchema } from "@/lib/correspondence-schema";
import { isStaffEmail, isStaffName } from "@/lib/staff-emails";
import { extractEmailFromText, guessNameFromEmail, guessOrgFromEmail, isRealContactEmail } from "@/lib/email-extract";
import { findContactByNameFallback, findContactBySubjectFallback } from "@/lib/contact-match";
import { findEmergingManagerMatch } from "@/lib/em-match";
import { htmlToText } from "@/lib/html-to-text";
import { CorrespondenceStatus } from "@prisma/client";
import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";

type Address = { address?: string; name?: string };

function addressList(field: AddressObject | AddressObject[] | undefined): Address[] {
  if (!field) return [];
  return (Array.isArray(field) ? field : [field]).flatMap((a) => a.value ?? []);
}

const formatAddresses = (list: Address[]) =>
  list
    .filter((a) => a.address)
    .map((a) => (a.name ? `${a.name} <${a.address}>` : a.address))
    .join("; ") || null;

const isOurDomain = (email: string) => email.toLowerCase().endsWith("@arselleinvestments.com");

/**
 * Pulls the header facts the webhook needs out of the saved .eml: the To/Cc
 * lines as text, and who "the contact" is — the sender when they're outside
 * the company, otherwise the first outside recipient (the same rule the
 * historical .eml import uses). Returns null if the file can't be read.
 */
async function readEmlHeaders(emlBase64: string) {
  try {
    const mail = await simpleParser(Buffer.from(emlBase64, "base64"));
    const to = addressList(mail.to);
    const cc = addressList(mail.cc);
    const from = addressList(mail.from)[0];
    const outsider = (a?: Address) => !!a?.address && !isStaffEmail(a.address) && !isOurDomain(a.address) && isRealContactEmail(a.address);
    const contact = outsider(from) ? from : [...to, ...cc].find(outsider);
    return {
      toText: formatAddresses(to),
      ccText: formatAddresses(cc),
      contactEmail: contact?.address?.toLowerCase() ?? null,
      contactName: contact?.name && !isStaffName(contact.name) ? contact.name : null,
    };
  } catch (e) {
    console.error("Could not read the .eml sent with the message; using the body only", e);
    return null;
  }
}

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
  // Forwarded emails arrive as HTML; store and classify the readable text.
  const cleanedBody = htmlToText(data.bodyText) || data.bodyText;

  // The saved .eml, when the flow sends it, is the reliable source for who a
  // message was from and to — the channel post's own body doesn't show the
  // recipients of mail we sent. A bad/unreadable file just means we fall back
  // to the body-based matching below, same as before.
  const eml = data.emlBase64 ? await readEmlHeaders(data.emlBase64) : null;
  const toText = data.to || eml?.toText || null;
  const ccText = data.cc || eml?.ccText || null;
  // Put the recipients at the top, as in the original email, so the matching
  // below sees who it was sent to (skipped if the body already shows them).
  const headerLines = [
    toText && !cleanedBody.includes(toText) ? `To: ${toText}` : null,
    ccText && !cleanedBody.includes(ccText) ? `Cc: ${ccText}` : null,
  ].filter(Boolean);
  const bodyText = headerLines.length ? `${headerLines.join("\n")}\n\n${cleanedBody}` : cleanedBody;

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
    extracted = await extractContactFromMessage(data.subject ?? "", bodyText);
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
  } else if (extracted.email && !isRealContactEmail(extracted.email)) {
    // Not a usable address (Agora relay, Teams thread id) — drop just the
    // address; a name found alongside it can still be right.
    extracted.email = null;
  }
  // A staff member's own name can slip through even when the email the model
  // (or header) landed on isn't theirs — e.g. a quoted "From: Aaron Greeno"
  // line in a forwarded thread. Never accept one of our own as "the contact."
  if (isStaffName(extracted.name)) {
    extracted.name = null;
  }
  // Header-derived identity beats anything inferred from the text: a message
  // from one of us goes to its first outside recipient; one from outside is
  // from them (see readEmlHeaders).
  if (eml?.contactEmail) {
    const sameAsModel = extracted.email?.toLowerCase() === eml.contactEmail;
    extracted.email = eml.contactEmail;
    // A name the model found for a different address would be someone else's.
    extracted.name = eml.contactName ?? (sameAsModel ? extracted.name : null);
  }
  // The model sometimes finds a name but misses the email even when one's
  // sitting right in the message (a signature block, a quoted reply) — a
  // plain regex scan catches those cases the AI extraction didn't.
  if (!extracted.email) {
    extracted.email = extractEmailFromText(bodyText);
  }
  // Best-effort fill-ins from the email itself when nothing else supplied a
  // name/org — better than leaving a new-contact suggestion with a blank
  // name and a real email sitting right next to it.
  if (!extracted.name && extracted.email) {
    extracted.name = guessNameFromEmail(extracted.email);
  }
  if (!extracted.org && extracted.email) {
    extracted.org = guessOrgFromEmail(extracted.email);
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
      bodyText,
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
      bodyText,
    });
    if (updated) finalCorrespondence = updated;
  }

  return NextResponse.json({ correspondence: finalCorrespondence }, { status: 201 });
}
