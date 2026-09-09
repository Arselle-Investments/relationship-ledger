import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";

const schema = z.object({
  primaryId: z.string().trim().min(1),
  secondaryIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one company to merge in."),
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
  const { primaryId, secondaryIds } = parsed.data;
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

    for (const s of secondaries) {
      tags = mergeArrays(tags, s.tags);
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
    }

    await tx.company.update({
      where: { id: primaryId },
      data: { tags, notes, targetAssetClasses, investmentStructures, investmentStrategies, investmentSizeMin, investmentSizeMax, city, tier, type },
    });

    await tx.company.deleteMany({ where: { id: { in: secondaryIds } } });
  });

  const merged = await prisma.company.findUnique({ where: { id: primaryId } });
  return NextResponse.json({ company: merged });
}
