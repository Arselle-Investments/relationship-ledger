import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Contact, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";

const schema = z.object({
  primaryId: z.string().trim().min(1),
  secondaryIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one contact to merge in."),
  // User-chosen winning value for a field where the merging contacts had
  // genuinely different real values — takes priority over the
  // fill-blank-from-secondary default below. Keyed by field name.
  resolutions: z.record(z.string(), z.string()).optional(),
  // When true, computes and returns what the merge *would* produce without
  // writing anything — powers the "preview before you commit" step so a
  // reviewer can catch a field that merged in a way they didn't expect.
  dryRun: z.boolean().optional(),
});

function mergeArrays(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

/**
 * Computes the final field values a merge would produce: fills anything the
 * primary is missing from the first secondary that has it, unions array
 * fields, and — for a field where the primary already has a value that a
 * secondary disagrees with — keeps the primary's value unless a resolution
 * overrides it, preserving the alternate as a note so it's never silently
 * lost. Pure and side-effect-free so both the dry-run preview and the real
 * merge use exactly the same computation — no risk of the preview lying
 * about what actually gets written.
 */
function computeMerge(primary: Contact, secondaries: Contact[], resolutions?: Record<string, string>) {
  let tags = primary.tags;
  let notes = primary.notes ?? "";
  let staffNames = primary.staffNames;
  let email = primary.email;
  let phone = primary.phone;
  let city = primary.city;
  let primaryLocation = primary.primaryLocation;
  let org = primary.org;
  let companyId = primary.companyId;
  let ownerId = primary.ownerId;
  let warmPathId = primary.warmPathId;
  let lastContact = primary.lastContact;
  let cadenceOverrideDays = primary.cadenceOverrideDays;
  let priorityQuarter = primary.priorityQuarter;
  let agoraType = primary.agoraType;
  let commitmentLow = primary.commitmentLow;
  let commitmentHigh = primary.commitmentHigh;
  let emailTier = primary.emailTier;
  let researchBio = primary.researchBio;
  let researchBioSource = primary.researchBioSource;
  let researchNews = primary.researchNews;
  let researchUpdatedAt = primary.researchUpdatedAt;
  let agoraRaw = primary.agoraRaw;

  const preservedNotes: string[] = [];

  for (const s of secondaries) {
    tags = mergeArrays(tags, s.tags);
    staffNames = mergeArrays(staffNames, s.staffNames);
    if (s.notes && s.notes.trim() && s.notes.trim() !== notes.trim()) {
      notes = [notes, s.notes.trim()].filter(Boolean).join("\n");
    }
    if (!email && s.email) email = s.email;
    else if (email && s.email && s.email.toLowerCase() !== email.toLowerCase()) {
      preservedNotes.push(`Alternate email on a merged duplicate: ${s.email}`);
    }
    if (!phone && s.phone) phone = s.phone;
    if (!city && s.city) city = s.city;
    if (!primaryLocation && s.primaryLocation) primaryLocation = s.primaryLocation;
    if (!org && s.org) org = s.org;
    else if (org && s.org && s.org.trim().toLowerCase() !== org.trim().toLowerCase()) {
      preservedNotes.push(`Alternate organization on a merged duplicate: ${s.org}`);
    }
    if (!companyId && s.companyId) companyId = s.companyId;
    if (!ownerId && s.ownerId) ownerId = s.ownerId;
    if (!warmPathId && s.warmPathId) warmPathId = s.warmPathId;
    if (!lastContact || (s.lastContact && s.lastContact > lastContact)) lastContact = s.lastContact ?? lastContact;
    if (!cadenceOverrideDays && s.cadenceOverrideDays) cadenceOverrideDays = s.cadenceOverrideDays;
    if (!priorityQuarter && s.priorityQuarter) priorityQuarter = s.priorityQuarter;
    if (!agoraType && s.agoraType) agoraType = s.agoraType;
    if (commitmentLow == null || (s.commitmentLow != null && s.commitmentLow < commitmentLow)) commitmentLow = s.commitmentLow ?? commitmentLow;
    if (commitmentHigh == null || (s.commitmentHigh != null && s.commitmentHigh > commitmentHigh)) commitmentHigh = s.commitmentHigh ?? commitmentHigh;
    if (!emailTier && s.emailTier) emailTier = s.emailTier;
    if (!researchBio && s.researchBio) {
      researchBio = s.researchBio;
      researchBioSource = s.researchBioSource;
      researchUpdatedAt = s.researchUpdatedAt;
    }
    if (!researchNews && s.researchNews) researchNews = s.researchNews;
    if (!agoraRaw && s.agoraRaw) agoraRaw = s.agoraRaw;
  }

  if (preservedNotes.length > 0) {
    notes = [notes, ...preservedNotes].filter(Boolean).join("\n");
  }

  // A resolution the reviewer picked in the preview step always wins.
  if (resolutions?.org) org = resolutions.org;
  if (resolutions?.email) email = resolutions.email;
  if (resolutions?.phone) phone = resolutions.phone;
  if (resolutions?.city) city = resolutions.city;
  if (resolutions?.notes) notes = resolutions.notes;

  return {
    tags, notes, staffNames, email, phone, city, primaryLocation, org, companyId, ownerId, warmPathId,
    lastContact, cadenceOverrideDays, priorityQuarter, agoraType, commitmentLow, commitmentHigh, emailTier,
    researchBio, researchBioSource, researchNews, researchUpdatedAt, agoraRaw,
  };
}

/**
 * Folds one or more duplicate contacts into a primary: reassigns everything
 * that pointed at them (tasks, correspondence, stage history, deal
 * feedback), then removes them. Never drops data — a field the primary is
 * missing gets filled from a secondary, and a differing value that can't be
 * merged outright (a different org string, say) is preserved in notes
 * rather than silently discarded.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { primaryId, secondaryIds, resolutions, dryRun } = parsed.data;
  if (secondaryIds.includes(primaryId)) {
    return NextResponse.json({ error: "The primary contact can't also be one of the ones being merged in." }, { status: 400 });
  }

  const [primary, secondaries] = await Promise.all([
    prisma.contact.findUnique({ where: { id: primaryId } }),
    prisma.contact.findMany({ where: { id: { in: secondaryIds } } }),
  ]);
  if (!primary) return NextResponse.json({ error: "Primary contact not found." }, { status: 404 });
  if (secondaries.length !== secondaryIds.length) {
    return NextResponse.json({ error: "One of the contacts to merge in was not found." }, { status: 404 });
  }

  const computed = computeMerge(primary, secondaries, resolutions);

  if (dryRun) {
    return NextResponse.json({ preview: { ...primary, ...computed } });
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });
    await tx.correspondence.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });
    await tx.contactStatusChange.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });
    await tx.dealFeedback.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });

    await tx.contact.update({
      where: { id: primaryId },
      data: {
        ...computed,
        researchNews: computed.researchNews === null ? Prisma.JsonNull : computed.researchNews,
        agoraRaw: computed.agoraRaw === null ? Prisma.JsonNull : computed.agoraRaw,
      },
    });
    await tx.contact.deleteMany({ where: { id: { in: secondaryIds } } });
  });

  const merged = await prisma.contact.findUnique({ where: { id: primaryId }, include: { owner: true, warmPath: true, company: true } });
  return NextResponse.json({ contact: merged });
}
