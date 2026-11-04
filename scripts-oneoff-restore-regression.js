const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Warm Path values wrongly wiped by applying a stale (pre-migration) spreadsheet
// over live data. Same source as scripts-oneoff-apply-warmpath-intros.js.
const WARM_PATH_BY_NAME = {
  "Ricardo Goldberg": "GSP (Mikee)",
  "Todd Rich": "Doug Faron",
  "Niv Henn": "Kirsch",
  "Olivia John": "GSP (Mikee)",
  "John Walton": "Doug Faron",
  "Chad Kanoff": "Aaron's bschool classmate Drake Watten",
  "James Foote": "Kirsch",
  "Dylan Alfa": "Kirsch",
  "Royce Hadden": "GSP (Mikee)",
  "Herb Myers": "Spencer Levy; Ross School RE Symposium (Sept 2024)",
  "Brandon Banks": "GSP (Mikee)",
  "Josh Troxel": "Monica Scieszka",
  "Michael Postetter": "Gendelman",
  "Omar Hossain": "Kirsch",
  "Emily Rivers": "GSP (Mikee)",
  "Chase Levi": "Paul McDonald; Shari Stewart",
  "Dan Sandbrink": "Paul McDonald; Shari Stewart",
  "Matt Cornue": "Kirsch",
  "Megan Gutnikov": "GSP (Mikee)",
  "Zach Georgeson": "Kirsch",
  "Tom Costigan": "Kirsh",
  "JD Johnson": "Dan Katz (Brightspire)",
  "Taylor Beaupain": "Kirsch",
  "Jon Monkarsh": "Kirsch",
  "Shea O'Gara": "Kenny Woermer",
  "Michael Buchman": "Mark Tronstein",
  "Jonah Gill": "GSP (Mikee)",
  "Carly Beckman": "GSP (Mikee)",
};

const RECORD_CONTEXT_RESTORE = {
  "Doug Bond": ["PLATFORM_LEVEL_OPCO", "FUND"],
  "Michael Levy": ["DEAL", "MGMT_CO", "PLATFORM_LEVEL_OPCO", "FUND"],
  "Brendon Lydon": ["DEAL", "PLATFORM_LEVEL_OPCO", "FUND"],
  "Eric Newberg": ["DEAL", "PLATFORM_LEVEL_OPCO", "FUND"],
  "Eric Plesman": ["DEAL", "PLATFORM_LEVEL_OPCO", "FUND"],
  "Julian Stone-Kronberg": ["DEAL", "PLATFORM_LEVEL_OPCO", "FUND"],
  "Michael Joseph": ["PLATFORM_LEVEL_OPCO", "FUND"],
};

async function main() {
  for (const [name, warmPath] of Object.entries(WARM_PATH_BY_NAME)) {
    const res = await prisma.contact.updateMany({ where: { name }, data: { warmPath } });
    console.log(`warmPath restored: ${name} -> "${warmPath}" (matched ${res.count})`);
  }

  await prisma.contact.updateMany({ where: { name: "Jon Monkarsh" }, data: { tier: "TIER_2" } });
  console.log("tier restored: Jon Monkarsh -> TIER_2");

  await prisma.contact.updateMany({ where: { name: "Aaron DiGenova" }, data: { doNotContact: true } });
  await prisma.contact.updateMany({ where: { name: "Raffi Tachdjian" }, data: { doNotContact: true } });
  console.log("doNotContact restored: Aaron DiGenova, Raffi Tachdjian -> true");

  for (const [name, recordContexts] of Object.entries(RECORD_CONTEXT_RESTORE)) {
    const res = await prisma.contact.updateMany({ where: { name }, data: { recordContexts } });
    console.log(`recordContexts restored: ${name} -> [${recordContexts.join(", ")}] (matched ${res.count})`);
  }

  await prisma.contact.updateMany({ where: { name: "Shaun Menkhaus" }, data: { status: "COMMITTED" } });
  console.log("status restored: Shaun Menkhaus -> COMMITTED");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
