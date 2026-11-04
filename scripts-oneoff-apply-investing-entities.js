// Fills Contact.investingEntity from the reviewed "fund-prospects-investing-entity" sheet.
//   node --env-file=.env.local scripts-oneoff-apply-investing-entities.js <sheet.xlsx>           (dry run)
//   node --env-file=.env.local scripts-oneoff-apply-investing-entities.js <sheet.xlsx> --apply
// Also gives each Fund prospect at the five firms that used to count per person
// (JLL, CBRE, Citizens Private Wealth, Morgan Stanley, City of Santa Barbara) an
// entity of their own name, so they keep counting individually.
const E = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BY = "Bianca Tomkoria";
const SPLIT = ["jll", "cbre", "citizens private wealth", "morgan stanley", "city of santa barbara"];
const val = (c) => { const v = c.value; return v == null ? "" : typeof v === "object" ? String(v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join("") : "")) : String(v); };

(async () => {
  const wb = new E.Workbook(); await wb.xlsx.readFile(process.argv[2]);
  const ws = wb.getWorksheet("Contacts");
  const hm = {}; ws.getRow(1).values.forEach((h, i) => { if (h) hm[h] = i; });
  const ie = new Map();
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = val(ws.getRow(r).getCell(1)); const v = val(ws.getRow(r).getCell(hm["Investing Entity"])).trim();
    if (id && v) ie.set(id, v);
  }
  const sel = { id: true, name: true, tags: true, recordContexts: true, companyId: true, company: { select: { name: true } }, ...(APPLY ? { investingEntity: true } : {}) };
  const contacts = await prisma.contact.findMany({ select: sel });
  const plan = [];
  for (const c of contacts) {
    let want = ie.get(c.id) ?? null;
    const fund = c.recordContexts.includes("FUND") && !c.tags.includes("Not a Fund Prospect");
    if (!want && fund && c.company && SPLIT.includes(c.company.name.trim().toLowerCase())) want = c.name;
    if (want && want !== (c.investingEntity ?? null)) plan.push({ c, want });
  }
  console.log((APPLY ? "APPLYING " : "DRY RUN: would set ") + plan.length + " investing entities (sheet " + ie.size + ")");
  if (!APPLY) { plan.slice(0, 8).forEach((p) => console.log("  ", p.c.name, "->", p.want)); await prisma.$disconnect(); return; }
  for (const { c, want } of plan) {
    await prisma.contact.update({ where: { id: c.id }, data: { investingEntity: want }, select: { id: true } });
    await prisma.editLogEntry.create({ data: { entityType: "Contact", entityId: c.id, entityLabel: c.name, field: "investingEntity", oldValue: c.investingEntity ?? null, newValue: want, changedByName: BY } });
  }
  console.log("done");
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message.slice(0, 400)); process.exit(1); });
