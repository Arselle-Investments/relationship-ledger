const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const companies = await p.company.findMany({
    where: { investmentStrategies: { has: "Value-Add / Opp" } },
    select: { name: true, investmentStrategies: true, notes: true },
    orderBy: { name: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Value-Add vs Opportunistic");
  sheet.columns = [
    { header: "Company", key: "name", width: 38 },
    { header: "Current Strategy Tags", key: "strategies", width: 28 },
    { header: "Notes (for context)", key: "notes", width: 60 },
    { header: "Value-Add?", key: "valueAdd", width: 12 },
    { header: "Opportunistic?", key: "opportunistic", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of companies) {
    const row = sheet.addRow({
      name: c.name,
      strategies: c.investmentStrategies.join(", "),
      notes: c.notes ?? "",
      valueAdd: "",
      opportunistic: "",
    });
    row.getCell("valueAdd").dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No"'] };
    row.getCell("opportunistic").dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No"'] };
  }

  sheet.autoFilter = { from: "A1", to: "E1" };
  sheet.getColumn("notes").alignment = { wrapText: false };

  const outPath = process.argv[2];
  await wb.xlsx.writeFile(outPath);
  console.log("Wrote", companies.length, "companies to", outPath);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
