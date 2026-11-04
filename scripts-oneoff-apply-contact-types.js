// Applies the Final Type column from the user's edited contacts-only sheet.
// Matches by exact Contact.id — safer than name matching since this sheet
// has known duplicate names in it (that's the whole point of the review).
// We don't have IDs in the sheet, so match by (name, email) pair instead,
// which is unique enough for this dataset; anything ambiguous is skipped
// and reported rather than guessed at.
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
  Lender: "LENDER",
};

async function main() {
  const filePath = process.argv[2];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  const updates = [];
  const unresolved = [];
  const skippedDuplicateFlagged = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = String(row.getCell(1).value || "").trim();
    const email = row.getCell(3).value ? String(row.getCell(3).value).trim() : "";
    const finalLabel = row.getCell(6).value ? String(row.getCell(6).value).trim() : null;
    const dup = row.getCell(7).value;
    if (!name || !finalLabel) return;
    if (dup) {
      skippedDuplicateFlagged.push({ row: rowNumber, name, email, finalLabel, dup });
      return; // handled separately via the merge plan, not a plain type update
    }
    const key = LABEL_TO_KEY[finalLabel];
    if (!key) {
      unresolved.push({ row: rowNumber, name, finalLabel });
      return;
    }
    updates.push({ name, email, type: key });
  });

  console.log("Rows to apply as plain type updates:", updates.length);
  console.log("Rows held back (duplicate-flagged, handled separately):", skippedDuplicateFlagged.length);
  if (unresolved.length) {
    console.log("UNRESOLVED labels:", JSON.stringify(unresolved));
    process.exit(1);
  }

  let updated = 0;
  let notFound = [];
  let ambiguous = [];
  for (const { name, email, type } of updates) {
    const matches = await p.contact.findMany({ where: { name, email: email || null } });
    if (matches.length === 0) {
      // fall back to name-only if email was blank in the sheet (common for
      // manually-created contacts) — only if that's unambiguous.
      const byName = await p.contact.findMany({ where: { name } });
      if (byName.length === 1) {
        if (byName[0].type !== type) {
          await p.contact.update({ where: { id: byName[0].id }, data: { type } });
          updated++;
        }
        continue;
      }
      notFound.push({ name, email });
      continue;
    }
    if (matches.length > 1) {
      ambiguous.push({ name, email, count: matches.length });
      continue;
    }
    if (matches[0].type !== type) {
      await p.contact.update({ where: { id: matches[0].id }, data: { type } });
      updated++;
    }
  }

  console.log("");
  console.log("--- Results ---");
  console.log("Contacts updated:", updated);
  if (notFound.length) console.log("Not found:", JSON.stringify(notFound));
  if (ambiguous.length) console.log("Ambiguous (multiple matches):", JSON.stringify(ambiguous));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
