// Merges confirmed duplicate companies, using the exact same logic as
// src/app/api/companies/merge/route.ts (computeMerge + the same transaction
// steps for Contact/DealFeedback/DealOutreach reassignment) — just invoked
// directly via Prisma instead of over HTTP, since this needs to run outside
// an authenticated browser session.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// [primaryName, [secondaryNames...]] — primary is the one kept.
const PAIRS = [
  ["Adept Urban Development", ["Adept Urban"]],
];

function mergeArrays(a, b) {
  return Array.from(new Set([...a, ...b]));
}

function computeMerge(primary, secondaries) {
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
  const preservedNotes = [];

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
    if (!founded && s.founded) founded = s.founded;
    if (!priorityQuarter && s.priorityQuarter) priorityQuarter = s.priorityQuarter;
    if (s.name.trim().toLowerCase() !== primary.name.trim().toLowerCase()) {
      preservedNotes.push(`Also known as: ${s.name}`);
    }
  }
  if (preservedNotes.length) notes = [notes, ...preservedNotes].filter(Boolean).join("\n");

  return {
    tags, notes, targetAssetClasses, investmentStructures, investmentStrategies, investmentSizeMin, investmentSizeMax,
    city, tier, type, sources, website, linkedinUrl, aum, founded, priorityQuarter,
  };
}

async function mergeOne(primaryName, secondaryNames) {
  const primary = await p.company.findUnique({ where: { name: primaryName } });
  if (!primary) {
    console.log(`SKIP: primary "${primaryName}" not found`);
    return;
  }
  const secondaries = await p.company.findMany({ where: { name: { in: secondaryNames } } });
  if (secondaries.length !== secondaryNames.length) {
    const found = secondaries.map((s) => s.name);
    console.log(`SKIP: some secondaries not found for "${primaryName}" — wanted ${JSON.stringify(secondaryNames)}, found ${JSON.stringify(found)}`);
    return;
  }
  const secondaryIds = secondaries.map((s) => s.id);
  const computed = computeMerge(primary, secondaries);

  await p.$transaction(async (tx) => {
    await tx.contact.updateMany({ where: { companyId: { in: secondaryIds } }, data: { companyId: primary.id, org: primary.name } });
    await tx.dealFeedback.updateMany({ where: { companyId: { in: secondaryIds } }, data: { companyId: primary.id } });

    const secondaryOutreach = await tx.dealOutreach.findMany({ where: { companyId: { in: secondaryIds } } });
    const primaryDealIds = new Set(
      (await tx.dealOutreach.findMany({ where: { companyId: primary.id }, select: { dealId: true } })).map((o) => o.dealId)
    );
    for (const o of secondaryOutreach) {
      if (primaryDealIds.has(o.dealId)) {
        await tx.dealOutreach.delete({ where: { id: o.id } });
      } else {
        await tx.dealOutreach.update({ where: { id: o.id }, data: { companyId: primary.id } });
        primaryDealIds.add(o.dealId);
      }
    }

    await tx.company.update({ where: { id: primary.id }, data: computed });
    await tx.company.deleteMany({ where: { id: { in: secondaryIds } } });
  });

  console.log(`MERGED: ${secondaryNames.join(", ")} -> ${primaryName} (contacts reassigned + org synced, final type: ${computed.type})`);
}

async function main() {
  for (const [primaryName, secondaryNames] of PAIRS) {
    await mergeOne(primaryName, secondaryNames);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
