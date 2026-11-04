// Merges confirmed duplicate contacts, using the same logic as
// src/app/api/contacts/merge/route.ts (computeMerge + the same transaction
// steps for Task/Correspondence/ContactStatusChange/DealFeedback
// reassignment), invoked directly via Prisma instead of over HTTP.
// `forceType` overrides computeMerge's default type-fill behavior when the
// user's sheet picked a specific Final Type that wouldn't otherwise win.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// [primaryId, [secondaryIds...], forceType | null]
const PAIRS = [
  ["cmtwz75zz000tt9q9ltabvhr1", ["cmtbpjwuo01dehrsisd4fy00w"], "PRIVATE_EQUITY_FUND"], // Andrew Fenet
  ["cmtbpjwtp017khrsifvuof7xa", ["cmtm040h300e510iqqjb41r4r"], "PUBLIC_PENSION_PLAN"], // Brendon Lydon
  ["cmtbpjwuj01crhrsirhy1stk6", ["cmtbpjwu0019ehrsikppw09l0"], "OTHER"], // Christopher Clarke
  ["cmtbpjwsn011jhrsi94150n7k", ["cmtm03msh006d10iq4exo2xna"], "INDIVIDUAL"], // Daniel Neidich
  ["cmtwz6vg7000ht9q90zs4zvrl", ["cmtbpjwr500t7hrsi352nb7tx"], "PRIVATE_EQUITY_FUND"], // Ian Finlay
  ["cmtbpjwu801alhrsi21vvn98i", ["cmtm048el00ie10iqnaf56535"], "OTHER"], // Jennifer Wenzel
  ["cmtw45cgx00048svkis5cqg4q", ["cmtbpjwu1019hhrsihz78aj0r"], "OTHER"], // Joshua Myers (keep this name+id; Josh Myers has the real email, fills in automatically)
  ["cmtbpjwvy01l5hrsii94ev0ub", ["cmtm03l8c005h10iqc3ubrt8e"], "SINGLE_FAMILY_OFFICE"], // Michael Hyun
  ["cmtbpjwts0180hrsiu9fnzxjv", ["cmtbpjwvd01hjhrsixzdog73x"], "SERVICE_PROVIDER"], // Michael Sovik
  ["cmtbpjwv401g1hrsi50e8ajyu", ["cmtbpjwtx018uhrsib2oa2s2v"], "INDIVIDUAL"], // Tim Morris
  // Thomas Mullahey (correct double-L spelling per Bianca 2026-09-24) absorbs
  // both other variants; Private Equity Fund per the "Tom Mulahey" row's Final Type.
  ["cmtbpjwsl0119hrsiemhngtfu", ["cmtbpjwsl011ahrsiudd7a6tv", "cmtm03c3h000q10iqssp7c72d"], "PRIVATE_EQUITY_FUND"],
  ["cmtbpjwuq01dthrsi3fqcnke1", ["cmtwz7f9k0015t9q9wci2bhr1"], "PRIVATE_EQUITY_FUND"], // Tracey Gamble, tgamble@apollo.com confirmed correct
];

// Rename map applied to the primary AFTER merge, only where the canonical
// spelling differs from what's currently stored.
const RENAME = {
  cmtbpjwsl0119hrsiemhngtfu: "Thomas Mullahey",
};

function mergeArrays(a, b) {
  return Array.from(new Set([...a, ...b]));
}

function computeMerge(primary, secondaries, forceType) {
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

  const preservedNotes = [];

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

  return {
    tags, notes, staffNames, email, phone, city, primaryLocation, org, companyId, ownerId, warmPathId,
    lastContact, cadenceOverrideDays, priorityQuarter, agoraType, commitmentLow, commitmentHigh, emailTier,
    researchBio, researchBioSource, researchNews, researchUpdatedAt, agoraRaw,
    type: forceType || primary.type,
  };
}

async function mergeOne(primaryId, secondaryIds, forceType) {
  const primary = await p.contact.findUnique({ where: { id: primaryId } });
  if (!primary) {
    console.log(`SKIP: primary ${primaryId} not found`);
    return;
  }
  const secondaries = await p.contact.findMany({ where: { id: { in: secondaryIds } } });
  if (secondaries.length !== secondaryIds.length) {
    console.log(`SKIP: some secondaries not found for ${primary.name} (${primaryId})`);
    return;
  }
  const computed = computeMerge(primary, secondaries, forceType);
  const rename = RENAME[primaryId];

  await p.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });
    await tx.correspondence.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });
    await tx.contactStatusChange.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });
    await tx.dealFeedback.updateMany({ where: { contactId: { in: secondaryIds } }, data: { contactId: primaryId } });

    await tx.contact.update({
      where: { id: primaryId },
      data: {
        ...computed,
        ...(rename ? { name: rename } : {}),
      },
    });
    await tx.contact.deleteMany({ where: { id: { in: secondaryIds } } });
  });

  console.log(`MERGED: ${secondaries.map((s) => s.name).join(", ")} -> ${rename || primary.name} (email: ${computed.email}, type: ${computed.type})`);
}

async function main() {
  for (const [primaryId, secondaryIds, forceType] of PAIRS) {
    await mergeOne(primaryId, secondaryIds, forceType);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
