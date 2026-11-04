// Applies the Final Type column from scratch-company-type-review.xlsx.
// - Company rows: update Company.type, then cascade to every linked Contact
//   (per Bianca's "sync company + its employees to the same type" rule).
// - Standalone Contact rows (no linked company): update Contact.type directly,
//   matched by name + companyId IS NULL (the exact population the sheet was
//   built from — verified zero name collisions in that population first).
// "GP" is substituted to "CRE Sponsor" per instruction (2026-09-23).
// Skips the BentallGreenOak/Bentall Green Oak/BGO rows — flagged as a
// possible misclick (typed "Insurance Company"), still awaiting confirmation.
const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const LABEL_TO_KEY = {
  "Placement Agent": "PLACEMENT_AGENT",
  Other: "OTHER",
  "Public Pension Plan": "PUBLIC_PENSION_PLAN",
  "Private Pension Plan": "PRIVATE_PENSION_PLAN",
  "Institutional Investor": "INSTITUTIONAL_INVESTOR",
  Endowment: "ENDOWMENT",
  Foundation: "FOUNDATION",
  "Insurance Company": "INSURANCE_COMPANY",
  "Sovereign Wealth Fund": "SOVEREIGN_WEALTH_FUND",
  "Single Family Office": "SINGLE_FAMILY_OFFICE",
  "Multi Family Office": "MULTI_FAMILY_OFFICE",
  "Wealth Manager": "WEALTH_MANAGER",
  HNW: "HNW",
  Individual: "INDIVIDUAL",
  "Family Member": "FAMILY_MEMBER",
  "Trusts/Trustee": "TRUSTS_TRUSTEE",
  "Private Equity Fund": "PRIVATE_EQUITY_FUND",
  "Fund of Funds": "FUND_OF_FUNDS",
  "Hedge Fund": "HEDGE_FUND",
  Advisor: "ADVISOR",
  Lawyer: "LAWYER",
  "Service Provider": "SERVICE_PROVIDER",
  "CRE Sponsor": "CRE_SPONSOR",
  Broker: "BROKER",
  GP: "CRE_SPONSOR", // substitution per Bianca 2026-09-23
};

const HOLD_BACK = new Set(); // BentallGreenOak group confirmed 2026-09-23 — no longer held back

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("scratch-company-type-review.xlsx");
  const sheet = wb.worksheets[0];

  const companyUpdates = [];
  const contactUpdates = [];
  const skipped = [];
  const unresolvedLabels = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const kind = row.getCell(1).value;
    const name = String(row.getCell(2).value || "").trim();
    const finalLabel = row.getCell(7).value ? String(row.getCell(7).value).trim() : null;
    if (!name || !finalLabel) return;
    if (HOLD_BACK.has(name)) {
      skipped.push({ name, reason: "held back pending type confirmation" });
      return;
    }
    const key = LABEL_TO_KEY[finalLabel];
    if (!key) {
      unresolvedLabels.push({ row: rowNumber, name, finalLabel });
      return;
    }
    if (kind === "Company") companyUpdates.push({ name, type: key });
    else if (kind === "Contact") contactUpdates.push({ name, type: key });
  });

  console.log("Company rows with a Final Type to apply:", companyUpdates.length);
  console.log("Standalone contact rows with a Final Type to apply:", contactUpdates.length);
  console.log("Held back pending confirmation:", skipped.length, skipped.map((s) => s.name).join(", "));
  if (unresolvedLabels.length) {
    console.log("UNRESOLVED labels (not in LABEL_TO_KEY) — stopping, fix the script first:");
    unresolvedLabels.forEach((u) => console.log(" ", JSON.stringify(u)));
    process.exit(1);
  }

  let companiesUpdated = 0;
  let contactsCascaded = 0;
  let companiesNotFound = [];
  for (const { name, type } of companyUpdates) {
    const company = await p.company.findUnique({ where: { name } });
    if (!company) {
      companiesNotFound.push(name);
      continue;
    }
    if (company.type !== type) {
      await p.company.update({ where: { id: company.id }, data: { type } });
      companiesUpdated++;
    }
    const cascade = await p.contact.updateMany({ where: { companyId: company.id }, data: { type } });
    contactsCascaded += cascade.count;
  }

  let standaloneContactsUpdated = 0;
  let contactsNotFound = [];
  for (const { name, type } of contactUpdates) {
    const contact = await p.contact.findFirst({ where: { name, companyId: null } });
    if (!contact) {
      contactsNotFound.push(name);
      continue;
    }
    if (contact.type !== type) {
      await p.contact.update({ where: { id: contact.id }, data: { type } });
      standaloneContactsUpdated++;
    }
  }

  console.log("");
  console.log("--- Results ---");
  console.log("Companies whose own type changed:", companiesUpdated);
  console.log("Contacts updated via company cascade:", contactsCascaded);
  console.log("Standalone contacts whose own type changed:", standaloneContactsUpdated);
  if (companiesNotFound.length) console.log("Companies not found by name (check for a rename/typo):", companiesNotFound);
  if (contactsNotFound.length) console.log("Standalone contacts not found by name (check for a rename/typo):", contactsNotFound);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
