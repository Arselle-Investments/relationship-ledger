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

async function main() {
  // Every contact, not just org-less ones — Agora only ever has a Contacts
  // upload (no bulk Organization import exists), so Contact is the real unit
  // of review going forward; Company is just a convenience grouping inside
  // the Ledger, not something Agora itself round-trips.
  const contacts = await p.contact.findMany({
    include: { company: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Contact Type Review");
  sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Org", key: "org", width: 32 },
    { header: "Email", key: "email", width: 32 },
    { header: "Current Type", key: "current", width: 22 },
    { header: "Raw Agora Type", key: "agoraType", width: 22 },
    { header: "Final Type", key: "final", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of contacts) {
    const row = sheet.addRow({
      name: c.name,
      org: c.company?.name ?? c.org ?? "",
      email: c.email ?? "",
      current: LABELS[c.type] || c.type,
      agoraType: c.agoraType ?? "",
      final: LABELS[c.type] || c.type,
    });
    row.getCell("final").dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${Object.values(LABELS).join(",")}"`],
    };
  }

  sheet.autoFilter = { from: "A1", to: "F1" };

  const outPath = process.argv[2];
  await wb.xlsx.writeFile(outPath);
  console.log("Wrote", contacts.length, "contacts to", outPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
