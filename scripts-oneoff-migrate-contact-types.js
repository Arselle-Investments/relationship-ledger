// One-off data migration: reclassify Contact.type and Company.type from the
// old 7-value ContactType enum onto the new curated-Agora-picklist subset.
// Mirrors AGORA_TYPE_TO_CONTACT_TYPE in src/lib/agora-import.ts exactly —
// delete this file once run.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const AGORA_TYPE_TO_CONTACT_TYPE = {
  "public pension plan": "PUBLIC_PENSION_PLAN",
  "private pension plan": "PRIVATE_PENSION_PLAN",
  "institutional investor": "INSTITUTIONAL_INVESTOR",
  "pension fund": "INSTITUTIONAL_INVESTOR",
  endowment: "ENDOWMENT",
  foundation: "FOUNDATION",
  "insurance company": "INSURANCE_COMPANY",
  "sovereign wealth fund": "SOVEREIGN_WEALTH_FUND",
  "family office": "FAMILY_OFFICE",
  "single family office": "SINGLE_FAMILY_OFFICE",
  "multi family office": "MULTI_FAMILY_OFFICE",
  "family office/ria": "FAMILY_OFFICE_RIA",
  "wealth manager": "WEALTH_MANAGER",
  hnw: "HNW",
  "hnw investor": "HNW",
  individual: "INDIVIDUAL",
  "family member": "FAMILY_MEMBER",
  "trusts/trustee": "TRUSTS_TRUSTEE",
  "private equity fund": "PRIVATE_EQUITY_FUND",
  "gp fund": "PRIVATE_EQUITY_FUND",
  "lp fund": "PRIVATE_EQUITY_FUND",
  "fund of funds": "FUND_OF_FUNDS",
  "hedge fund": "HEDGE_FUND",
  "placement agent": "PLACEMENT_AGENT",
  advisor: "ADVISOR",
  lawyer: "LAWYER",
  "service provider": "SERVICE_PROVIDER",
};

const OLD_ENUM_CROSSWALK = {
  LP_INSTITUTIONAL: "INSTITUTIONAL_INVESTOR",
  FAMILY_OFFICE: "FAMILY_OFFICE",
  BROKER_ADVISOR: "ADVISOR",
  SPONSOR_COGP: "PRIVATE_EQUITY_FUND",
  CONSULTANT: "SERVICE_PROVIDER",
  PLACEMENT_AGENT: "PLACEMENT_AGENT",
  OTHER: "OTHER",
};

async function main() {
  console.log("--- Contact: reclassifying by agoraType where present ---");
  const distinctAgoraTypes = await p.contact.groupBy({
    by: ["agoraType"],
    _count: { agoraType: true },
    where: { agoraType: { not: null } },
  });
  for (const row of distinctAgoraTypes) {
    const key = row.agoraType.trim().toLowerCase();
    const newType = AGORA_TYPE_TO_CONTACT_TYPE[key] ?? "OTHER";
    const res = await p.contact.updateMany({
      where: { agoraType: row.agoraType },
      data: { type: newType },
    });
    console.log(`  ${row._count.agoraType} contacts with agoraType="${row.agoraType}" -> ${newType} (updated ${res.count})`);
  }

  console.log("--- Contact: crosswalking manual-only rows (agoraType IS NULL) ---");
  for (const [oldType, newType] of Object.entries(OLD_ENUM_CROSSWALK)) {
    if (oldType === newType) continue;
    const res = await p.contact.updateMany({
      where: { agoraType: null, type: oldType },
      data: { type: newType },
    });
    if (res.count > 0) console.log(`  ${oldType} -> ${newType}: ${res.count} contacts`);
  }

  console.log("--- Company: crosswalking all rows (no agoraType field exists) ---");
  for (const [oldType, newType] of Object.entries(OLD_ENUM_CROSSWALK)) {
    if (oldType === newType) continue;
    const res = await p.company.updateMany({
      where: { type: oldType },
      data: { type: newType },
    });
    if (res.count > 0) console.log(`  ${oldType} -> ${newType}: ${res.count} companies`);
  }

  console.log("--- Verification: any rows still on a deprecated value? ---");
  const deprecated = ["LP_INSTITUTIONAL", "BROKER_ADVISOR", "SPONSOR_COGP", "CONSULTANT"];
  const contactLeft = await p.contact.count({ where: { type: { in: deprecated } } });
  const companyLeft = await p.company.count({ where: { type: { in: deprecated } } });
  console.log("Contacts still on a deprecated type:", contactLeft);
  console.log("Companies still on a deprecated type:", companyLeft);

  console.log("--- Final Contact.type distribution ---");
  const finalContact = await p.contact.groupBy({ by: ["type"], _count: { type: true }, orderBy: { _count: { type: "desc" } } });
  finalContact.forEach((r) => console.log(" ", String(r._count.type).padStart(5), "|", r.type));

  console.log("--- Final Company.type distribution ---");
  const finalCompany = await p.company.groupBy({ by: ["type"], _count: { type: true }, orderBy: { _count: { type: "desc" } } });
  finalCompany.forEach((r) => console.log(" ", String(r._count.type).padStart(5), "|", r.type));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
