// After the DealFeedbackStage migration, the 62 feedback rows that used to be
// "Active Prospect" all landed on ENGAGEMENT_SHOWN. This re-sorts each one using its
// notes (plus the Capital Partner Outreach sheet's notes), per Bianca's sign-off.
// Reads the ids from tmp_scratch/active_prospect_review.json (captured pre-migration).
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const key = (deal, company) => `${deal}|${company}`;
const DECLINED = new Set([
  key("&Pico", "Olive Point"),
  ...["Center Square", "CIGNA", "Corebridge", "Eastham Capital", "EJM", "Fox Hollow Ventures", "WAFRA",
      "Affinius Capital", "Somera", "Sculptor"].map((c) => key("Hiawatha", c)),
  ...["Alex Brown Capital (ABR)", "Freestone Real Estate", "Oaktree", "PGIM", "Fortress"].map((c) => key("Monterra", c)),
]);
const DUE_DILIGENCE = new Set([
  key("Hiawatha", "KKR"), key("Hiawatha", "Angelo Gordon"),
  key("Monterra", "Fox Hollow Ventures"), key("Monterra", "Ares"),
]);
const OUTREACH_SENT = new Set([
  key("Hiawatha", "Abady"), key("Hiawatha", "Moshe Silagi"),
  ...["Abady", "Andell", "Appian Capital", "DCI", "Declaration Partners", "Drake", "Eagle Realty",
      "Eaton Vance (Morgan Stanley)", "Elysium Management LLC", "Evergen", "FCP", "Fox Capital Partners",
      "Heyman Enterprise", "Invesco", "Morgan Stanley", "Moshe Silagi", "PIMCO", "Piedmont Capital Investments"]
    .map((c) => key("Monterra", c)),
]);

function stageFor(deal, company) {
  const k = key(deal, company);
  if (DECLINED.has(k)) return "DECLINED";
  if (DUE_DILIGENCE.has(k)) return "DUE_DILIGENCE";
  if (OUTREACH_SENT.has(k)) return "OUTREACH_SENT";
  return "ENGAGEMENT_SHOWN"; // reviewing / asked questions / expressed interest
}

async function main() {
  const rows = JSON.parse(fs.readFileSync("tmp_scratch/active_prospect_review.json", "utf8"));
  const counts = {};
  for (const r of rows) {
    const stage = stageFor(r.deal, r.company);
    counts[stage] = (counts[stage] || 0) + 1;
    await p.dealFeedback.update({ where: { id: r.id }, data: { status: stage } });
    console.log(`${stage.padEnd(18)} [${r.deal}] ${r.company || "(no company)"}`);
  }
  console.log("\nre-sorted", rows.length, counts);
  const all = await p.dealFeedback.groupBy({ by: ["status"], _count: true });
  console.log("DealFeedback now:", all.map((x) => `${x.status}=${x._count}`).join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
