import { NextRequest, NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { extractContactFromMessage } from "@/lib/ai";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { isStaffEmail } from "@/lib/staff-emails";
import { findContactByNameFallback, findContactBySubjectFallback } from "@/lib/contact-match";
import { findEmergingManagerMatch } from "@/lib/em-match";
import { CorrespondenceStatus } from "@prisma/client";
import type { AddressObject } from "mailparser";

function addressList(field: AddressObject | AddressObject[] | undefined) {
  if (!field) return [];
  const arr = Array.isArray(field) ? field : [field];
  return arr.flatMap((a) => a.value ?? []);
}

/**
 * One-time historical backfill: parses a batch of .eml files (saved investor
 * emails from before the Fundraising Teams channel existed) into the same
 * Correspondence pipeline the live Teams webhook feeds — matched contacts
 * get a stage-signal check, unmatched senders show up in the Inbox as
 * suggested contacts, exactly like a live message would.
 *
 * A .eml's own From header is structured, reliable data, so it's used
 * directly for the sender's name/email rather than asking the model to guess
 * it from body text (which is what the Teams path has to do, since a
 * forwarded message's real sender is buried in freeform text). The model is
 * only called when that header doesn't resolve to an existing contact —
 * once it does, org is already on file and there's nothing left to extract.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
  }

  let matched = 0;
  let suggested = 0;
  let duplicates = 0;
  const failed: string[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await simpleParser(buffer);

      const messageId = parsed.messageId || null;
      if (messageId) {
        const existing = await prisma.correspondence.findUnique({ where: { externalId: messageId } });
        if (existing) {
          duplicates++;
          continue;
        }
      }

      const subject = parsed.subject || "";
      const bodyText = parsed.text || "";
      const fromEntry = !Array.isArray(parsed.from) ? parsed.from?.value?.[0] : undefined;
      let headerEmail = fromEntry?.address?.toLowerCase() || null;
      let headerName = fromEntry?.name || null;

      if (isStaffEmail(headerEmail)) {
        // This is one of our own team's sent/forwarded emails — the sender
        // isn't "the contact." Use the first external recipient instead.
        const recipients = [...addressList(parsed.to), ...addressList(parsed.cc)];
        const external = recipients.find((r) => r.address && !isStaffEmail(r.address));
        headerEmail = external?.address?.toLowerCase() || null;
        headerName = external?.name || null;
      }

      // A confident header-based match means there's nothing left for AI to
      // add — org is already on file for an existing contact, and identity
      // is already known. Only call the model when the header didn't
      // resolve to an existing contact.
      let contactId: string | null = null;
      if (headerEmail) {
        const match = await prisma.contact.findFirst({
          where: { email: { equals: headerEmail, mode: "insensitive" } },
        });
        if (match) contactId = match.id;
      }
      if (!contactId && headerName) {
        contactId = await findContactByNameFallback(headerName);
      }
      if (!contactId) {
        contactId = await findContactBySubjectFallback(subject);
      }

      let extractedEmail = headerEmail;
      let extractedName = headerName;
      let extractedOrg: string | null = null;

      if (!contactId) {
        const extracted = await extractContactFromMessage(subject, bodyText);
        extractedEmail = headerEmail || extracted.email;
        extractedName = headerName || extracted.name;
        extractedOrg = extracted.org;
        if (isStaffEmail(extractedEmail)) {
          extractedEmail = null;
          extractedName = null;
        }
        if (extractedEmail && extractedEmail !== headerEmail) {
          const match = await prisma.contact.findFirst({
            where: { email: { equals: extractedEmail, mode: "insensitive" } },
          });
          if (match) contactId = match.id;
        }
        if (!contactId && extractedName && extractedName !== headerName) {
          contactId = await findContactByNameFallback(extractedName);
        }
      }

      let consultantId: string | null = null;
      let capitalSourceId: string | null = null;
      if (!contactId) {
        const emMatch = await findEmergingManagerMatch(extractedOrg, subject);
        if (emMatch && "consultantId" in emMatch) consultantId = emMatch.consultantId;
        else if (emMatch && "capitalSourceId" in emMatch) capitalSourceId = emMatch.capitalSourceId;
      }
      const matchedId = contactId || consultantId || capitalSourceId;

      const correspondence = await prisma.correspondence.create({
        data: {
          source: "eml_import",
          externalId: messageId,
          subject: subject || null,
          bodyText,
          receivedAt: parsed.date ?? new Date(),
          contactId,
          consultantId,
          capitalSourceId,
          extractedName,
          extractedEmail,
          extractedOrg,
          status: matchedId ? CorrespondenceStatus.MATCHED : CorrespondenceStatus.SUGGESTED,
        },
      });

      if (matchedId) {
        await maybeCreateStageSuggestion({
          correspondenceId: correspondence.id,
          contactId,
          consultantId,
          capitalSourceId,
          subject,
          bodyText,
        });
        matched++;
      } else {
        suggested++;
      }
    } catch (e) {
      console.error("Failed to import .eml file", file.name, e);
      failed.push(file.name);
    }
  }

  return NextResponse.json({ matched, suggested, duplicates, failed });
}
