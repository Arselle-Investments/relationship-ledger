import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { maybeCreateStageSuggestion } from "@/lib/stage-signal";
import { isPlaceholderEmail } from "@/lib/contact-schema";
import { CorrespondenceStatus, ContactType, ContactTier, RecordContext } from "@prisma/client";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), contactId: z.string().min(1) }),
  z.object({
    mode: z.literal("new"),
    name: z.string().trim().min(1, "Name is required."),
    org: z.string().trim().optional().nullable(),
    // A brand-new contact needs an email, city and state before it can go to
    // Agora. No real email yet → firstnamelastname@needemail.com (see
    // isPlaceholderEmail).
    email: z
      .string()
      .trim()
      .min(1, "Email is required. If you don't have it, use firstnamelastname@needemail.com.")
      .email("That doesn't look like a valid email."),
    phone: z.string().trim().optional().nullable(),
    city: z.string().trim().min(1, "City is required."),
    state: z.string().trim().min(1, "State is required."),
    title: z.string().trim().optional().nullable(),
    ownerId: z.string().trim().optional().nullable(),
    // Richer fields the quick-create form can optionally set up front, so a
    // contact confirmed straight from a Teams message doesn't need a second
    // edit pass before it's ready for an Agora export (see
    // buildAgoraContactRow — tags and tier both feed directly into it).
    type: z.nativeEnum(ContactType).optional(),
    tier: z.nativeEnum(ContactTier).optional(),
    tags: z.array(z.string().trim()).optional(),
    priorityQuarter: z.string().trim().optional().nullable(),
    warmPath: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    recordContexts: z.array(z.nativeEnum(RecordContext)).optional(),
  }),
]);

/** Confirms a suggested correspondence entry — link it to an existing contact, or create a new one. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const correspondence = await prisma.correspondence.findUnique({ where: { id } });
  if (!correspondence) return NextResponse.json({ error: "Correspondence not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  let contactId: string;
  let shouldClassify = false;
  if (parsed.data.mode === "existing") {
    const contact = await prisma.contact.findUnique({ where: { id: parsed.data.contactId } });
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    contactId = contact.id;
    shouldClassify = true; // an established contact has a real "current stage" to signal a move from
  } else {
    // Guard against creating an exact duplicate of a contact that's already
    // on file — e.g. two people confirming the same untangled message, or a
    // contact added since this suggestion first appeared (see
    // scripts-oneoff-apply-comprehensive.js and the Gallucci merge for how
    // this actually happened once already). If the email already matches an
    // existing contact, link to that one instead — filling in any fields it
    // was missing from what was typed here, never overwriting what's already
    // there.
    const existingByEmail = parsed.data.email
      ? await prisma.contact.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } } })
      : null;

    if (existingByEmail) {
      const notesToAdd = [
        parsed.data.title && !(existingByEmail.notes ?? "").includes(parsed.data.title)
          ? `Title: ${parsed.data.title}`
          : "",
        parsed.data.notes && !(existingByEmail.notes ?? "").includes(parsed.data.notes) ? parsed.data.notes : "",
      ].filter(Boolean);
      const newNotes =
        notesToAdd.length > 0
          ? [existingByEmail.notes, ...notesToAdd].filter(Boolean).join("\n")
          : existingByEmail.notes;
      await prisma.contact.update({
        where: { id: existingByEmail.id },
        data: {
          org: existingByEmail.org ?? parsed.data.org ?? null,
          phone: existingByEmail.phone ?? parsed.data.phone ?? null,
          city: existingByEmail.city ?? parsed.data.city ?? null,
          state: existingByEmail.state ?? parsed.data.state ?? null,
          warmPath: existingByEmail.warmPath ?? parsed.data.warmPath ?? null,
          notes: newNotes,
          tags: Array.from(new Set([...existingByEmail.tags, ...(parsed.data.tags ?? [])])),
          recordContexts: Array.from(new Set([...existingByEmail.recordContexts, ...(parsed.data.recordContexts ?? [])])),
        },
      });
      contactId = existingByEmail.id;
      shouldClassify = true; // an established contact has a real "current stage" to signal a move from
    } else {
      const contact = await prisma.contact.create({
        data: {
          name: parsed.data.name,
          org: parsed.data.org || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          ownerId: parsed.data.ownerId || actingUser.id,
          notes: [parsed.data.title ? `Title: ${parsed.data.title}` : "", parsed.data.notes ?? ""].filter(Boolean).join("\n"),
          warmPath: parsed.data.warmPath || null,
          // Same rule as POST /api/contacts: nothing goes out to a placeholder address.
          doNotContact: isPlaceholderEmail(parsed.data.email),
          ...(parsed.data.type ? { type: parsed.data.type } : {}),
          ...(parsed.data.tier ? { tier: parsed.data.tier } : {}),
          ...(parsed.data.tags ? { tags: parsed.data.tags } : {}),
          priorityQuarter: parsed.data.priorityQuarter || null,
          recordContexts: parsed.data.recordContexts ?? [],
        },
      });
      contactId = contact.id;
      // A brand-new contact has no stage to move from, but if they were created
      // as a Fund prospect, the message that surfaced them can still say where
      // they belong (e.g. an email we sent them = Outreach Sent). Anyone not
      // marked Fund is skipped inside maybeCreateStageSuggestion.
      shouldClassify = contact.recordContexts.includes("FUND");
    }
  }

  const updated = await prisma.correspondence.update({
    where: { id },
    data: { contactId, status: CorrespondenceStatus.MATCHED },
  });

  let finalCorrespondence = updated;
  if (shouldClassify) {
    const withSuggestion = await maybeCreateStageSuggestion({
      correspondenceId: id,
      contactId,
      subject: correspondence.subject ?? "",
      bodyText: correspondence.bodyText,
    });
    if (withSuggestion) finalCorrespondence = withSuggestion;
  }

  return NextResponse.json({ correspondence: finalCorrespondence });
}
