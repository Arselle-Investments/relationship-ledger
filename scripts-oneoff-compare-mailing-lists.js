const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseCsv(path) {
  const text = fs.readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows = lines.slice(1).map((line) => {
    const [first, last, email] = line.split(",");
    return { first: (first || "").trim(), last: (last || "").trim(), email: (email || "").trim().toLowerCase() };
  });
  return rows.filter((r) => r.email);
}

function normName(first, last) {
  return `${first} ${last}`.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

async function compare(csvPath, tagNames, label, allContactsByName) {
  const csvRows = parseCsv(csvPath);
  const csvByEmail = new Map(csvRows.map((r) => [r.email, r]));
  const nameCount = new Map();
  for (const r of csvRows) {
    const n = normName(r.first, r.last);
    nameCount.set(n, (nameCount.get(n) || 0) + 1);
  }

  const dbContacts = await prisma.contact.findMany({
    where: { tags: { hasSome: tagNames } },
    select: { id: true, name: true, email: true },
  });
  const taggedIds = new Set(dbContacts.map((c) => c.id));
  const dbByEmail = new Map(dbContacts.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));

  const inCsvNotDb = csvRows.filter((r) => !dbByEmail.has(r.email));
  const inDbNotCsv = dbContacts.filter((c) => c.email && !csvByEmail.has(c.email.toLowerCase()));

  console.log(`\n=== ${label} ===`);
  console.log(`CSV rows: ${csvRows.length} | DB tagged: ${dbContacts.length}`);

  const trueGaps = [];
  const alreadyFine = [];
  console.log(`\nIn CSV but not matched by email in DB (${inCsvNotDb.length}):`);
  for (const r of inCsvNotDb) {
    const n = normName(r.first, r.last);
    const dupInCsv = nameCount.get(n) > 1;
    const existing = allContactsByName.get(n);
    if (existing && taggedIds.has(existing.id)) {
      alreadyFine.push({ r, existing });
    } else {
      trueGaps.push({ r, existing, dupInCsv });
    }
  }
  console.log(`  Already correctly tagged (just a different email on file) — no action needed: ${alreadyFine.length}`);
  console.log(`  Genuinely need the tag added: ${trueGaps.length}`);
  for (const { r, existing, dupInCsv } of trueGaps) {
    const note = existing
      ? ` -> existing untagged contact: "${existing.name}" <${existing.email ?? "no email"}> (id ${existing.id})`
      : " -> no matching contact found by name either — not in DB at all";
    console.log(`   + ${r.first} ${r.last} - ${r.email}${dupInCsv ? " [dup name in csv]" : ""}${note}`);
  }

  console.log(`\nTagged in DB but not matched by email in CSV (${inDbNotCsv.length}):`);
  for (const c of inDbNotCsv) {
    console.log(`   - ${c.name} - ${c.email} (id ${c.id})`);
  }
}

async function main() {
  const everyone = await prisma.contact.findMany({ select: { id: true, name: true, email: true } });
  const allContactsByName = new Map();
  for (const c of everyone) {
    const parts = c.name.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const n = normName(parts[0], parts[parts.length - 1]);
    if (!allContactsByName.has(n)) allContactsByName.set(n, c);
  }

  await compare(process.argv[2], ["Arselle Holiday Card"], "Holiday Card", allContactsByName);
  await compare(
    process.argv[3],
    ["End of Year Investor Letter", "End Of Year Letter 2025 (copy)"],
    "End of Year Investor Letter",
    allContactsByName
  );
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
