import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { ContactTier, ContactType } from "@prisma/client";

const schema = z.object({
  primaryId: z.string().trim().min(1),
  secondaryIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one company to merge in."),
  // User-chosen winning value for any field where the merging companies had
  // genuinely different real values (surfaced by the conflict-resolution
  // modal) — takes priority over the fill-blank-from-secondary default below.
  resolutions: z.record(z.string(), z.string()).optional(),
});

function mergeArrays(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

/** Folds one or more companies into a primary: reassigns everything that pointed at them, then removes them. */
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
  const { primaryId, secondaryIds, resolutions } = parsed.data;
  if (secondaryIds.includes(primaryId)) {
    return NextResponse.json({ error: "The primary company can't also be one of the ones being merged in." }, { status: 400 });
  }

  const [primary, secondaries] = await Promise.all([
    prisma.company.findUnique({ where: { id: primaryId } }),
    prisma.company.findMany({ where: { id: { in: secondaryIds } } }),
  ]);
  if (!primary) return NextResponse.json({ error: "Primary company not found." }, { status: 404 });
  if (secondaries.length !== secondaryIds.length) {
    return NextResponse.json({ error: "One of the companies to merge in was not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Contacts: repoint to the primary, and sync the free-text org string so
    // it doesn't keep showing a name that no longer has its own company record.
    await tx.contact.updateMany({ where: { companyId: { in: secondaryIds } }, data: { companyId: primaryId, org: primary.name } });

    // Deal feedback: straightforward reassignment, no uniqueness constraint to worry about.
    await tx.dealFeedback.updateMany({ where: { companyId: { in: secondaryIds } }, data: { companyId: primaryId } });

    // Deal outreach: unique on (dealId, companyId), so a secondary's row for a
    // deal the primary was already marked sent on would collide — drop the
    // secondary's redundant row in that case, and repoint the rest.
    const secondaryOutreach = await tx.dealOutreach.findMany({ where: { companyId: { in: secondaryIds } } });
    const primaryDealIds = new Set(
      (await tx.dealOutreach.findMany({ where: { companyId: primaryId }, select: { dealId: true } })).map((o) => o.dealId)
    );
    for (const o of secondaryOutreach) {
      if (primaryDealIds.has(o.dealId)) {
        await tx.dealOutreach.delete({ where: { id: o.id } });
      } else {
        await tx.dealOutreach.update({ where: { id: o.id }, data: { companyId: primaryId } });
        primaryDealIds.add(o.dealId);
      }
    }

    // Merge the secondaries' profile data into the primary wherever the primary is missing it.
    let tags = primary.tags;
    let notes = primary.notes ?? "";
    let targetAssetClasses = primary.targetAssetClasses;
    let investmentStructures = primary.investmentStructures;
    let investmentStrategies = primary.investmentStrategies;
    let investmentSizeMin = primary.investmentSizeMin;
    let investmentSizeMax = primary.investmentSizeMax;
    let city = primary.city;
    let tier = primary.tier;
    let type = primary.type;
    let sources = primary.sources;
    let website = primary.website;
    let linkedinUrl = primary.linkedinUrl;
    let aum = primary.aum;
    let founded = primary.founded;
    let priorityQuarter = primary.priorityQuarter;
    const preservedNotes: string[] = [];

    for (const s of secondaries) {
      tags = mergeArrays(tags, s.tags);
      sources = mergeArrays(sources, s.sources);
      targetAssetClasses = mergeArrays(targetAssetClasses, s.targetAssetClasses);
      investmentStructures = mergeArrays(investmentStructures, s.investmentStructures);
      investmentStrategies = mergeArrays(investmentStrategies, s.investmentStrategies);
      if (s.notes && s.notes.trim() && s.notes.trim() !== notes.trim()) {
        notes = [notes, s.notes.trim()].filter(Boolean).join("\n");
      }
      if (investmentSizeMin == null || (s.investmentSizeMin != null && s.investmentSizeMin < investmentSizeMin)) {
        investmentSizeMin = s.investmentSizeMin ?? investmentSizeMin;
      }
      if (investmentSizeMax == null || (s.investmentSizeMax != null && s.investmentSizeMax > investmentSizeMax)) {
        investmentSizeMax = s.investmentSizeMax ?? investmentSizeMax;
      }
      if (!city && s.city) city = s.city;
      if (!tier && s.tier) tier = s.tier;
      if (type === "OTHER" && s.type !== "OTHER") type = s.type;
      if (!website && s.website) website = s.website;
      if (!linkedinUrl && s.linkedinUrl) linkedinUrl = s.linkedinUrl;
      if (!aum && s.aum) aum = s.aum;
      else if (aum && s.aum && s.aum.trim() !== aum.trim() && !resolutions?.aum) {
        // No explicit resolution came through (e.g. a caller that skipped the
        // conflict-resolution modal) — fall back to preserving the discarded
        // figure as a note rather than silently dropping it.
        preservedNotes.push(`Alternate AUM figure on a merged duplicate (${s.name}): ${s.aum}`);
      }
      if (!founded && s.founded) founded = s.founded;
      if (!priorityQuarter && s.priorityQuarter) priorityQuarter = s.priorityQuarter;
      // A secondary's own name (the one not kept) is worth staying findable
      // by — otherwise a search for "Oaktree Capital Management" goes cold
      // once "Oaktree" absorbs it.
      if (s.name.trim().toLowerCase() !== primary.name.trim().toLowerCase()) preservedNotes.push(`Also known as: ${s.name}`);
    }
    if (preservedNotes.length) notes = [notes, ...preservedNotes].filter(Boolean).join("\n");

    // A resolution the user picked in the conflict modal always wins over the
    // fill-blank-from-secondary defaults above — that's what it means for a
    // field to have been a genuine conflict rather than one side just missing it.
    if (resolutions?.city) city = resolutions.city;
    if (resolutions?.tier && (Object.values(ContactTier) as string[]).includes(resolutions.tier)) tier = resolutions.tier as ContactTier;
    if (resolutions?.type && (Object.values(ContactType) as string[]).includes(resolutions.type)) type = resolutions.type as ContactType;
    if (resolutions?.website) website = resolutions.website;
    if (resolutions?.linkedinUrl) linkedinUrl = resolutions.linkedinUrl;
    if (resolutions?.aum) aum = resolutions.aum;
    if (resolutions?.founded) founded = resolutions.founded;
    if (resolutions?.priorityQuarter) priorityQuarter = resolutions.priorityQuarter;

    await tx.company.update({
      where: { id: primaryId },
      data: {
        tags, notes, targetAssetClasses, investmentStructures, investmentStrategies, investmentSizeMin, investmentSizeMax,
        city, tier, type, sources, website, linkedinUrl, aum, founded, priorityQuarter,
      },
    });

    await tx.company.deleteMany({ where: { id: { in: secondaryIds } } });
  });

  const merged = await prisma.company.findUnique({ where: { id: primaryId } });
  return NextResponse.json({ company: merged });
}
