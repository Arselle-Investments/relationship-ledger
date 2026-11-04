// Splits "Value-Add / Opp" into "Value-Add" and/or "Opportunistic" per
// Bianca's review in scratch-strategy-review.xlsx.
const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  const decisions = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = String(row.getCell(1).value || "").trim();
    const valueAdd = !!row.getCell(4).value;
    const opportunistic = !!row.getCell(5).value;
    if (!name) return;
    decisions.push({ name, valueAdd, opportunistic });
  });

  console.log("Decisions to apply:", decisions.length);
  let updated = 0;
  let bothFlagged = 0;
  let neitherFlagged = 0;
  const notFound = [];

  for (const { name, valueAdd, opportunistic } of decisions) {
    if (valueAdd && opportunistic) bothFlagged++;
    if (!valueAdd && !opportunistic) neitherFlagged++;

    const company = await p.company.findUnique({ where: { name } });
    if (!company) {
      notFound.push(name);
      continue;
    }
    const withoutCombined = company.investmentStrategies.filter((s) => s !== "Value-Add / Opp");
    const additions = [];
    if (valueAdd) additions.push("Value-Add");
    if (opportunistic) additions.push("Opportunistic");
    const nextStrategies = Array.from(new Set([...withoutCombined, ...additions]));

    await p.company.update({ where: { id: company.id }, data: { investmentStrategies: nextStrategies } });
    updated++;
  }

  console.log("Updated:", updated);
  console.log("Flagged as hybrid (both Yes):", bothFlagged);
  console.log("Flagged as neither (left unresolved, combined tag just removed with no replacement):", neitherFlagged);
  if (notFound.length) console.log("Not found:", JSON.stringify(notFound));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
