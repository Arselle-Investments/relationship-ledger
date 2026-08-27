import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { extractContactFromMessage } from "@/lib/ai";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { isStaffEmail } from "@/lib/staff-emails";
import { findContactByNameFallback } from "@/lib/contact-match";
import { CorrespondenceStatus } from "@prisma/client";

const messageSchema = z.object({
  sourceFile: z.string().optional(),
  messageId: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  fromName: z.string().nullable().optional(),
  fromEmail: z.string().nullable().optional(),
  text: z.string(),
});
const bodySchema = z.object({ messages: z.array(messageSchema) });

/**
 * Same historical-email ingestion pipeline as /api/correspondence/import-eml,
 * but takes already-parsed message data (JSON) instead of raw .eml files.
 * Large .eml attachments (multi-MB decks, PDFs) were tripping a body-size
 * limit when uploaded as raw multipart files, so heavy MIME parsing now
 * happens locally (stripping attachments we never needed anyway) and only
 * the extracted text/headers are sent here.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  let matched = 0;
  let suggested = 0;
  let duplicates = 0;
  const failed: string[] = [];

  for (const msg of parsed.data.messages) {
    try {
      if (msg.messageId) {
        const existing = await prisma.correspondence.findUnique({ where: { externalId: msg.messageId } });
        if (existing) {
          duplicates++;
          continue;
        }
      }

      const subject = msg.subject || "";
      const bodyText = msg.text || "";
      const headerEmail = msg.fromEmail || null;
      const headerName = msg.fromName || null;

      // A confident header-based match means there's nothing left for AI to
      // add — org is already on file for an existing contact, and identity
      // is already known. Only call the model when the header didn't
      // resolve to an existing contact (it either helps find one, or
      // supplies org/name for a new-contact suggestion).
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

      const correspondence = await prisma.correspondence.create({
        data: {
          source: "eml_import",
          externalId: msg.messageId || null,
          subject: subject || null,
          bodyText,
          receivedAt: msg.date ? new Date(msg.date) : new Date(),
          contactId,
          extractedName,
          extractedEmail,
          extractedOrg,
          status: contactId ? CorrespondenceStatus.MATCHED : CorrespondenceStatus.SUGGESTED,
        },
      });

      if (contactId) {
        await maybeCreateStageSuggestion({ correspondenceId: correspondence.id, contactId, subject, bodyText });
        matched++;
      } else {
        suggested++;
      }
    } catch (e) {
      console.error("Failed to import parsed message", msg.sourceFile, e);
      failed.push(msg.sourceFile ?? msg.messageId ?? "unknown");
    }
  }

  return NextResponse.json({ matched, suggested, duplicates, failed });
}
