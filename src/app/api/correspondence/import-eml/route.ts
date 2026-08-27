import { NextRequest, NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { extractContactFromMessage } from "@/lib/ai";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { CorrespondenceStatus } from "@prisma/client";

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
 * still used for organization, since that's rarely in the headers.
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
      const headerEmail = fromEntry?.address?.toLowerCase() || null;
      const headerName = fromEntry?.name || null;

      const extracted = await extractContactFromMessage(subject, bodyText);
      const extractedEmail = headerEmail || extracted.email;
      const extractedName = headerName || extracted.name;

      let contactId: string | null = null;
      if (extractedEmail) {
        const match = await prisma.contact.findFirst({
          where: { email: { equals: extractedEmail, mode: "insensitive" } },
        });
        if (match) contactId = match.id;
      }

      const correspondence = await prisma.correspondence.create({
        data: {
          source: "eml_import",
          externalId: messageId,
          subject: subject || null,
          bodyText,
          receivedAt: parsed.date ?? new Date(),
          contactId,
          extractedName,
          extractedEmail,
          extractedOrg: extracted.org,
          status: contactId ? CorrespondenceStatus.MATCHED : CorrespondenceStatus.SUGGESTED,
        },
      });

      if (contactId) {
        await maybeCreateStageSuggestion({
          correspondenceId: correspondence.id,
          contactId,
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
