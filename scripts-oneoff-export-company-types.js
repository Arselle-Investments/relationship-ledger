const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const LABELS = {
  PLACEMENT_AGENT: "Placement Agent",
  OTHER: "Other",
  PUBLIC_PENSION_PLAN: "Public Pension Plan",
  PRIVATE_PENSION_PLAN: "Private Pension Plan",
  INSTITUTIONAL_INVESTOR: "Institutional Investor",
  ENDOWMENT: "Endowment",
  FOUNDATION: "Foundation",
  INSURANCE_COMPANY: "Insurance Company",
  SOVEREIGN_WEALTH_FUND: "Sovereign Wealth Fund",
  SINGLE_FAMILY_OFFICE: "Single Family Office",
  MULTI_FAMILY_OFFICE: "Multi Family Office",
  WEALTH_MANAGER: "Wealth Manager",
  HNW: "HNW",
  INDIVIDUAL: "Individual",
  FAMILY_MEMBER: "Family Member",
  TRUSTS_TRUSTEE: "Trusts/Trustee",
  PRIVATE_EQUITY_FUND: "Private Equity Fund",
  FUND_OF_FUNDS: "Fund of Funds",
  HEDGE_FUND: "Hedge Fund",
  ADVISOR: "Advisor",
  LAWYER: "Lawyer",
  SERVICE_PROVIDER: "Service Provider",
  CRE_SPONSOR: "CRE Sponsor",
  BROKER: "Broker",
  LENDER: "Lender",
};
// SINGLE_FAMILY_OFFICE is included here too: as of this migration, every
// current occurrence of it is a placeholder default from a plain former
// "Family Office" record (no source data distinguishes single- vs.
// multi-family), not a confirmed classification.
const CROSSWALKED = new Set(["INSTITUTIONAL_INVESTOR", "ADVISOR", "PRIVATE_EQUITY_FUND", "SERVICE_PROVIDER", "SINGLE_FAMILY_OFFICE"]);

async function main() {
  const companies = await p.company.findMany({
    include: { contacts: { select: { type: true, email: true } } },
    orderBy: { name: "asc" },
  });

  const orgless = await p.contact.findMany({
    where: { companyId: null },
    select: { name: true, org: true, type: true, agoraType: true, email: true },
    orderBy: { name: "asc" },
  });

  // One combined sheet: a "Row Kind" column distinguishes a Company row
  // (whose Final Type cascades to every contact linked there) from a
  // standalone Contact row (no linked Company, reviewed individually).
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Type Review");
  sheet.columns = [
    { header: "Row Kind", key: "kind", width: 10 },
    { header: "Name", key: "name", width: 38 },
    { header: "Org / # Contacts", key: "context", width: 20 },
    { header: "Email / Email Domains on File", key: "email", width: 30 },
    { header: "Current Type", key: "current", width: 22 },
    { header: "Contact Types on File / Raw Agora Type", key: "breakdown", width: 45 },
    { header: "Auto-Crosswalked (needs review)", key: "flag", width: 14 },
    { header: "Final Type", key: "final", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of companies) {
    const counts = {};
    for (const ct of c.contacts) counts[ct.type] = (counts[ct.type] || 0) + 1;
    const breakdown = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => n + "x " + (LABELS[t] || t))
      .join(", ");
    const domains = Array.from(
      new Set(c.contacts.map((ct) => ct.email?.split("@")[1]?.toLowerCase()).filter(Boolean))
    );
    const row = sheet.addRow({
      kind: "Company",
      name: c.name,
      context: `${c.contacts.length} contact${c.contacts.length === 1 ? "" : "s"}`,
      email: domains.join(", "),
      current: LABELS[c.type] || c.type,
      breakdown,
      flag: CROSSWALKED.has(c.type) ? "YES" : "",
      final: LABELS[c.type] || c.type,
    });
    row.getCell("final").dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${Object.values(LABELS).join(",")}"`],
    };
  }

  for (const c of orgless) {
    const row = sheet.addRow({
      kind: "Contact",
      name: c.name,
      context: c.org ?? "",
      email: c.email ?? "",
      current: LABELS[c.type] || c.type,
      breakdown: c.agoraType ?? "",
      flag: "",
      final: LABELS[c.type] || c.type,
    });
    row.getCell("final").dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${Object.values(LABELS).join(",")}"`],
    };
  }

  sheet.autoFilter = { from: "A1", to: "H1" };

  const outPath = process.argv[2];
  await wb.xlsx.writeFile(outPath);
  console.log("Wrote", companies.length, "companies and", orgless.length, "org-less contacts to", outPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
