// Sets estimated commitments (investor -> dollars): a few typed in by hand, plus the
// subscription amount from each first-close sub doc, matched to the investor the
// funnel groups that subscriber under. Run after the EntityCommitment migration.
//   node --env-file=.env.local scripts-oneoff-set-commitments.js <subdocs.json>            (dry run)
//   node --env-file=.env.local scripts-oneoff-set-commitments.js <subdocs.json> --apply
const Module = require("module"), fs = require("fs"), path = require("path"), ts = require("typescript");
const root = __dirname, orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) { if (r.startsWith("@/")) r = path.join(root, "src", r.slice(2)); return orig.call(this, r, ...a); };
require.extensions[".ts"] = function (m, f) { m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, f); };
const { PrismaClient } = require("@prisma/client");
const { buildFundInvestors, isFundProspect, individualKey, investorKey } = require("./src/lib/fund-investors.ts");
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BY = "Bianca Tomkoria";

const TYPED = [["Rex Kalamian", 50000], ["Kevin Mekhsian", 250000], ["Sample Gates Management", 3000000]];

(async () => {
  const subs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const contacts = await prisma.contact.findMany();
  const companies = await prisma.company.findMany({ where: { OR: [{ recordContexts: { has: "FUND" } }, { contacts: { some: { recordContexts: { has: "FUND" } } } }] } });
  const inv = buildFundInvestors(companies, contacts);
  const keyOf = new Map(); // contact id -> investor key
  for (const i of inv) for (const c of i.contacts) keyOf.set(c.id, { key: i.key, name: i.name });
  for (const c of contacts.filter(isFundProspect)) if (!keyOf.has(c.id)) keyOf.set(c.id, { key: individualKey(c), name: c.investingEntity?.trim() || c.name });

  const plan = new Map(); // key -> { name, amount, from[] }
  const problems = [];
  for (const s of subs) {
    const emails = [s.email].filter(Boolean).map((e) => String(e).toLowerCase());
    const names = [s.sub1, s.sub2].filter(Boolean).map((n) => n.toLowerCase());
    const hits = new Map();
    for (const c of contacts) {
      if (!isFundProspect(c)) continue;
      const byEmail = c.email && emails.includes(c.email.toLowerCase());
      const byName = names.some((n) => n.split(/\s+/).filter((t) => t.length > 2).every((t) => c.name.toLowerCase().includes(t)));
      if (byEmail || byName) hits.set(c.id, c);
    }
    const targets = new Map([...hits.values()].map((c) => keyOf.get(c.id)).filter(Boolean).map((k) => [k.key, k]));
    const amount = Number(s.commit);
    if (!amount) { problems.push(`${s.header}: no amount`); continue; }
    if (targets.size !== 1) { problems.push(`${s.header}: matched ${targets.size} investors (${[...targets.values()].map((t) => t.name).join(" / ") || "none"})`); continue; }
    const t = [...targets.values()][0];
    const row = plan.get(t.key) ?? { name: t.name, amount: 0, from: [] };
    row.amount += amount; row.from.push(s.header);
    plan.set(t.key, row);
  }
  for (const [name, amount] of TYPED) plan.set(investorKey(name), { name, amount, from: ["typed"] });

  const total = [...plan.values()].reduce((a, r) => a + r.amount, 0);
  console.log((APPLY ? "APPLYING " : "DRY RUN: ") + plan.size + " investor amounts, total $" + total.toLocaleString("en-US"));
  for (const r of [...plan.values()].sort((a, b) => a.name.localeCompare(b.name))) console.log("  " + r.name + " = " + r.amount.toLocaleString("en-US") + (r.from.length > 1 || r.from[0] !== r.name ? "   <- " + r.from.join(" + ") : ""));
  problems.forEach((p) => console.log("PROBLEM:", p));
  if (APPLY) {
    for (const [key, r] of plan) {
      const existing = await prisma.entityCommitment.findUnique({ where: { key } });
      const row = await prisma.entityCommitment.upsert({ where: { key }, create: { key, name: r.name, amount: r.amount }, update: { amount: r.amount } });
      await prisma.editLogEntry.create({ data: { entityType: "EntityCommitment", entityId: row.id, entityLabel: r.name, field: "amount", oldValue: existing?.amount != null ? String(existing.amount) : null, newValue: String(r.amount), changedByName: BY } });
    }
    console.log("done");
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message.slice(0, 400)); process.exit(1); });
