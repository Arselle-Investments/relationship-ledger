// Read-only snapshot of the whole database for eyeballing: every scalar field on Contact and
// Company (straight from the Prisma schema, so new columns show up automatically), related-record
// counts, and a Yes/blank column for every tag. NOT a round-trip sheet — nothing reads it back.
const ExcelJS = require("exceljs");
const { PrismaClient, Prisma } = require("@prisma/client");
const p = new PrismaClient();

const MAX_CELL = 32000; // Excel's hard limit is 32,767 chars per cell

function fieldsOf(modelName, skip = []) {
  return Prisma.dmmf.datamodel.models
    .find((m) => m.name === modelName)
    .fields.filter((f) => f.kind !== "object" && !skip.includes(f.name));
}

function cell(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.join("; ");
  if (typeof v === "boolean") return v ? "Yes" : "";
  if (typeof v === "object") return JSON.stringify(v).slice(0, MAX_CELL); // Json columns
  if (typeof v === "string") return v.length > MAX_CELL ? v.slice(0, MAX_CELL) : v;
  return v;
}

function tagColumns(rows) {
  const counts = new Map();
  for (const r of rows) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: "A1", to: { row: 1, column: columns.length } };
  return ws;
}

async function main() {
  const outPath = process.argv[2];

  const contacts = await p.contact.findMany({
    include: {
      owner: { select: { name: true, email: true } },
      company: { select: { name: true } },
      _count: { select: { tasks: true, correspondence: true, stageChanges: true, dealFeedback: true } },
    },
    orderBy: { name: "asc" },
  });
  const companies = await p.company.findMany({
    include: { _count: { select: { contacts: true, feedback: true, outreach: true, stageChanges: true } } },
    orderBy: { name: "asc" },
  });

  const wb = new ExcelJS.Workbook();

  // ---- Contacts
  // agoraRaw is the raw import blob from Agora — huge and not useful to eyeball, so it's left out.
  const cFields = fieldsOf("Contact", ["agoraRaw"]);
  const cTags = tagColumns(contacts);
  const cCols = [
    ...cFields.map((f) => ({ header: f.name, key: f.name, width: f.name === "id" ? 26 : f.name === "name" ? 26 : 16 })),
    { header: "ownerName", key: "ownerName", width: 20 },
    { header: "companyName", key: "companyName", width: 28 },
    { header: "taskCount", key: "taskCount", width: 10 },
    { header: "correspondenceCount", key: "correspondenceCount", width: 12 },
    { header: "stageChangeCount", key: "stageChangeCount", width: 12 },
    { header: "dealFeedbackCount", key: "dealFeedbackCount", width: 12 },
    ...cTags.map(([t, n], i) => ({ header: `Tag: ${t} (${n})`, key: `tag_${i}`, width: 14 })),
  ];
  const cRows = contacts.map((c) => {
    const row = {};
    for (const f of cFields) row[f.name] = cell(c[f.name]);
    row.ownerName = c.owner?.name || c.owner?.email || "";
    row.companyName = c.company?.name ?? "";
    row.taskCount = c._count.tasks;
    row.correspondenceCount = c._count.correspondence;
    row.stageChangeCount = c._count.stageChanges;
    row.dealFeedbackCount = c._count.dealFeedback;
    cTags.forEach(([t], i) => { row[`tag_${i}`] = (c.tags ?? []).includes(t) ? "Yes" : ""; });
    return row;
  });
  addSheet(wb, "Contacts", cCols, cRows);

  // ---- Organizations (Company)
  const oFields = fieldsOf("Company");
  const oTags = tagColumns(companies);
  const oCols = [
    ...oFields.map((f) => ({ header: f.name, key: f.name, width: f.name === "id" ? 26 : f.name === "name" ? 30 : 16 })),
    { header: "contactCount", key: "contactCount", width: 10 },
    { header: "dealFeedbackCount", key: "dealFeedbackCount", width: 12 },
    { header: "dealOutreachCount", key: "dealOutreachCount", width: 12 },
    { header: "stageChangeCount", key: "stageChangeCount", width: 12 },
    ...oTags.map(([t, n], i) => ({ header: `Tag: ${t} (${n})`, key: `tag_${i}`, width: 14 })),
  ];
  const oRows = companies.map((c) => {
    const row = {};
    for (const f of oFields) row[f.name] = cell(c[f.name]);
    row.contactCount = c._count.contacts;
    row.dealFeedbackCount = c._count.feedback;
    row.dealOutreachCount = c._count.outreach;
    row.stageChangeCount = c._count.stageChanges;
    oTags.forEach(([t], i) => { row[`tag_${i}`] = (c.tags ?? []).includes(t) ? "Yes" : ""; });
    return row;
  });
  addSheet(wb, "Organizations", oCols, oRows);

  // ---- Tag summary: one row per tag across both tables
  const tagMap = new Map();
  for (const [t, n] of cTags) tagMap.set(t, { tag: t, contacts: n, organizations: 0 });
  for (const [t, n] of oTags) tagMap.set(t, { ...(tagMap.get(t) ?? { tag: t, contacts: 0 }), organizations: n });
  const tagRows = [...tagMap.values()].sort((a, b) => b.contacts - a.contacts || a.tag.localeCompare(b.tag));
  addSheet(wb, "Tags", [
    { header: "tag", key: "tag", width: 44 },
    { header: "contacts", key: "contacts", width: 12 },
    { header: "organizations", key: "organizations", width: 14 },
  ], tagRows);

  await wb.xlsx.writeFile(outPath);
  console.log(`Wrote ${contacts.length} contacts (${cCols.length} cols), ${companies.length} organizations (${oCols.length} cols), ${tagRows.length} tags -> ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
