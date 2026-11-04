const ExcelJS = require("exceljs");

const SHEETS = ["Institutional LPs", "Syndication Capital LPs"];
const COMPANY_COL = 3;
const INTRO_COL = 42;
const HEADER_ROW = 6;

async function main() {
  const path = process.argv[2];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  const results = [];
  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    // sanity check header
    const introHeader = ws.getRow(HEADER_ROW).getCell(INTRO_COL).value;
    const companyHeader = ws.getRow(HEADER_ROW).getCell(COMPANY_COL).value;
    console.log(`Sheet "${sheetName}": company header = ${JSON.stringify(companyHeader)}, intro header = ${JSON.stringify(introHeader)}`);

    for (let r = HEADER_ROW + 1; r <= ws.rowCount; r++) {
      const company = ws.getRow(r).getCell(COMPANY_COL).value;
      const intro = ws.getRow(r).getCell(INTRO_COL).value;
      if (intro && String(intro).trim() !== "") {
        results.push({ sheet: sheetName, row: r, company: company ? String(company).trim() : null, intro: String(intro).trim() });
      }
    }
  }

  console.log(`\nTotal rows with an Introduction value: ${results.length}\n`);
  for (const r of results) {
    console.log(`[${r.sheet} R${r.row}] Company="${r.company}" -> Introduction="${r.intro}"`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
