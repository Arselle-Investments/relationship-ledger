const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SHEETS = ["Institutional LPs", "Syndication Capital LPs"];
const COMPANY_COL = 3;
const INTRO_COL = 42;
const HEADER_ROW = 6;

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[\/&,.()]/g, " ")
    .replace(/\b(llc|lp|inc|co|corp|group|partners|capital|investments|investment|real estate|management)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const path = process.argv[2];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);

  const rows = [];
  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    for (let r = HEADER_ROW + 1; r <= ws.rowCount; r++) {
      const company = ws.getRow(r).getCell(COMPANY_COL).value;
      const intro = ws.getRow(r).getCell(INTRO_COL).value;
      if (intro && String(intro).trim() !== "") {
        rows.push({ sheet: sheetName, row: r, company: company ? String(company).trim() : null, intro: String(intro).trim() });
      }
    }
  }

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const byExact = new Map(companies.map((c) => [c.name.toLowerCase(), c]));
  const byNorm = new Map();
  for (const c of companies) {
    const n = normalize(c.name);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(c);
  }

  const exactMatches = [];
  const normMatches = [];
  const noMatches = [];

  for (const r of rows) {
    if (!r.company) {
      noMatches.push({ ...r, reason: "no company name in sheet" });
      continue;
    }
    const exact = byExact.get(r.company.toLowerCase());
    if (exact) {
      exactMatches.push({ ...r, dbCompany: exact });
      continue;
    }
    const n = normalize(r.company);
    const candidates = byNorm.get(n) ?? [];
    if (candidates.length === 1) {
      normMatches.push({ ...r, dbCompany: candidates[0] });
    } else if (candidates.length > 1) {
      noMatches.push({ ...r, reason: `ambiguous normalized match: ${candidates.map((c) => c.name).join(" | ")}` });
    } else {
      noMatches.push({ ...r, reason: "no DB company match found" });
    }
  }

  console.log(`\n=== EXACT MATCHES (${exactMatches.length}) ===`);
  for (const m of exactMatches) console.log(`"${m.company}" -> DB:"${m.dbCompany.name}" | intro="${m.intro}"`);

  console.log(`\n=== NORMALIZED/FUZZY MATCHES (${normMatches.length}) - please confirm these ===`);
  for (const m of normMatches) console.log(`"${m.company}" -> DB:"${m.dbCompany.name}" | intro="${m.intro}"`);

  console.log(`\n=== NO MATCH FOUND (${noMatches.length}) - please review ===`);
  for (const m of noMatches) console.log(`"${m.company}" (${m.sheet} R${m.row}) -> ${m.reason} | intro="${m.intro}"`);

  console.log(`\nTotals: exact=${exactMatches.length} fuzzy=${normMatches.length} unmatched=${noMatches.length} total=${rows.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
