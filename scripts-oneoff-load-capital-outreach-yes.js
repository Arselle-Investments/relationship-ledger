// One-off: load the people marked "Yes" in the Capital Partner Outreach List 16 vs. CRM check
// (10 from the "Not in CRM" tab + 2 new ones from "Needs manual review"). Skips anyone whose
// email or name+org is already on file. Run with `apply` to write; otherwise a dry run.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const OWNER_ID = "cmtbpjvob00t1hrsizvmhyj1z"; // Bianca Tomkoria
const TAG = "Capital Partner Outreach Import";

// [name, org, email, type, tier, warmPath, sheet/row]
const PEOPLE = [
  ["Brad Weinberg", "ARC Capital", "bweinberg@arccapitalpartners.com", "INSTITUTIONAL_INVESTOR", "TIER_3", null, "Institutional LPs r11"],
  ["Alex Weinrich", "ARC Capital", "aweinrich@arccapitalpartners.com", "INSTITUTIONAL_INVESTOR", "TIER_3", null, "Institutional LPs r11"],
  ["Gina Pfingston Wahl", "ARC Capital", "gpfingston@arccapitalpartners.com", "INSTITUTIONAL_INVESTOR", "TIER_3", null, "Institutional LPs r11"],
  ["Tom Mulahey", "AEW", null, "INSTITUTIONAL_INVESTOR", "TIER_1", null, "Institutional LPs r19"],
  ["Clayton Matsuda", "Barings", "clayton.matsuda@barings.com", "INSTITUTIONAL_INVESTOR", "TIER_2", null, "Institutional LPs r20"],
  ["David Rabin", "Declaration Partners", null, "SINGLE_FAMILY_OFFICE", "TIER_2", "Doug Faron", "Institutional LPs r27"],
  ["Chase Furr", "Crow Holdings", "cfurr@crowholdings.com", "SINGLE_FAMILY_OFFICE", "TIER_2", null, "Institutional LPs r42"],
  ["Christine Kang", "Clarion Partners", null, "INSTITUTIONAL_INVESTOR", "TIER_2", null, "Institutional LPs r67"],
  ["Kenneth Quach", "Corebridge", "kenneth.quach@corebridgefinancial.com", "INSTITUTIONAL_INVESTOR", "TIER_1", "GSP (Mikee)", "Institutional LPs r68"],
  ["Jon Klein", "Friedman / Westview", null, "LENDER", "TIER_3", null, "Institutional LPs r97"],
  ["Ivan Karpov", "Prospect Ridge", "ivan.karpov@prospectridge.com", "PRIVATE_EQUITY_FUND", "TIER_1", null, "Institutional LPs (Needs manual review)"],
  ["Christine Boyd", "Apollo", null, "LENDER", "TIER_2", null, "Institutional LPs (Needs manual review)"],
];

(async () => {
  const apply = process.argv[2] === "apply";
  for (const [name, org, email, type, tier, warmPath, src] of PEOPLE) {
    const dupe = await prisma.contact.findFirst({
      where: { OR: [...(email ? [{ email: { equals: email, mode: "insensitive" } }] : []), { name: { equals: name, mode: "insensitive" }, org: { equals: org, mode: "insensitive" } }] },
    });
    if (dupe) { console.log("SKIP (exists)", name, "->", dupe.name, dupe.org); continue; }
    const company = await prisma.company.findFirst({ where: { name: { equals: org, mode: "insensitive" } }, select: { id: true, name: true } });
    console.log(apply ? "CREATE" : "would create", name, "|", company ? company.name : `${org} (no company link)`, "|", email ?? "no email", "|", type, tier, warmPath ?? "");
    if (apply) {
      await prisma.contact.create({
        data: {
          name, org: company?.name ?? org, email, type, tier, warmPath, ownerId: OWNER_ID,
          tags: [TAG], notes: `[Added from Capital_Partner_Outreach_List_16] ${src}`,
          ...(company ? { companyId: company.id } : {}),
        },
      });
    }
  }
  await prisma.$disconnect();
})();
