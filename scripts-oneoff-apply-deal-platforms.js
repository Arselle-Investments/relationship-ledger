// Backfills Deal.platform from row 5 above the deal columns in the "Institutional LPs" /
// "Syndication Capital LPs" sheets of Capital_Partner_Outreach_List_16.xlsx (identical on
// both sheets; "Extra Space Sto. Sea." only appears on the Syndication sheet).
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const PLATFORM_BY_DEAL = {
  "1901": "Patina",
  "Loja": "Paragon",
  "Capri": "Direct",
  "Park Industrial": "GSC",
  "Bellgrave Business Park": "Kearny",
  "Buena Park": "Kearny",
  "Roscoe Woodley": "Kearny",
  "Carson Industrial Center": "Kearny",
  "Monterra": "Amoroso",
  "Jurupa Valley": "Kearny",
  "&Pico": "Amoroso",
  "West Jordan BP": "GSC",
  "Hiawatha": "Amoroso",
  "Extra Space Sto. Sea.": "Amoroso",
};

async function main() {
  const deals = await p.deal.findMany({ select: { id: true, name: true, platform: true } });
  for (const d of deals) {
    const platform = PLATFORM_BY_DEAL[d.name];
    if (!platform) { console.log(`SKIP (not in sheet): ${d.name}`); continue; }
    if (d.platform === platform) continue;
    await p.deal.update({ where: { id: d.id }, data: { platform } });
    console.log(`${d.name}: ${d.platform ?? "(none)"} -> ${platform}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
