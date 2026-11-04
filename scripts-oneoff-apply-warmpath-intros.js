const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Company -> Introduction (if applicable), pulled from the "Capital Partner
// Outreach List" (Institutional LPs + Syndication Capital LPs tabs, col 42).
// "Palatine" in the source sheet matched our "Palatine Capital Partners".
const PAIRS = [
  ["Olive Point", "GSP (Mikee)"],
  ["Declaration Partners", "Doug Faron"],
  ["Mountain Pacific", "Kirsch"],
  ["Osso Capital", "GSP (Mikee)"],
  ["Willoughby", "Doug Faron"],
  ["Sequoia Heritage", "Aaron's bschool classmate Drake Watten"],
  ["Belay", "Kirsch"],
  ["Corebridge", "GSP (Mikee)"],
  ["Investcorp (Bahrain based investor)", "Spencer Levy; Ross School RE Symposium (Sept 2024)"],
  ["Midloch Investment Partners", "GSP (Mikee)"],
  ["ReCap/RGA", "GSP (Mikee)"],
  ["Ameritas", "GSP (Mikee)"],
  ["Walton Street", "Monica Scieszka"],
  ["Freestone Real Estate", "Gendelman"],
  ["Acre Valley", "Kirsch"],
  ["Alex Brown Capital (ABR)", "GSP (Mikee)"],
  ["Appian Capital", "GSP (Mikee)"],
  ["Atlantic Creek", "GSP (Mikee)"],
  ["Basis", "GSP (Mikee)"],
  ["Beverly Pacific", "Kirsch"],
  ["Blue Vista", "GSP (Mikee)"],
  ["BMA Capital / BMA Group", "CohnReznick"],
  ["Center Square", "Kirsch"],
  ["Chief Partners", "GSP (Mikee)"],
  ["Eagle Realty", "GSP (Mikee)"],
  ["Eastham Capital", "GSP (Mikee)"],
  ["Evergen", "Kirsch"],
  ["FCP", "GSP (Mikee)"],
  ["Flagship", "GSP (Mikee)"],
  ["Grandview Partners", "Paul McDonald; Shari Stewart"],
  ["Heyman Enterprise", "Spencer Levy"],
  ["Horowitz Group", "Kirsch"],
  ["JDI", "GSP (Mikee)"],
  ["KCB", "GSP (Mikee)"],
  ["Landrock", "GSP (Mikee)"],
  ["LEM Capital", "GSP (Mikee)"],
  ["Locus", "Kirsch / Direct"],
  ["Marble Capital", "GSP (Mikee)"],
  ["MileRock", "Kirsch"],
  ["Monument Square", "John Drachman"],
  ["Neltnet", "GSP (Mikee)"],
  ["Pennybacker", "Kirsh"],
  ["RCP", "GSP (Mikee)"],
  ["Selfridge Capital", "Dan Katz (Brightspire)"],
  ["Thrive", "GSP (Mikee)"],
  ["Walker and Dunlop", "CohnReznick"],
  ["Taylor Beaupain", "Kirsch"],
  ["EJM", "Kirsch"],
  ["Straight Arrow", "Kenny Woermer"],
  ["Hilton Foundation", "Mark Tronstein"],
  ["Palatine Capital Partners", "GSP (Mikee)"],
];

async function main() {
  let updated = 0;
  let skippedAlreadySet = 0;
  let companiesWithNoContacts = 0;

  for (const [name, intro] of PAIRS) {
    const company = await prisma.company.findFirst({
      where: { name },
      include: { contacts: { select: { id: true, name: true, warmPath: true } } },
    });
    if (!company) {
      console.log(`SKIP: no company found for "${name}"`);
      continue;
    }
    if (company.contacts.length === 0) {
      companiesWithNoContacts++;
      continue;
    }
    for (const contact of company.contacts) {
      if (contact.warmPath && contact.warmPath.trim() !== "") {
        console.log(`SKIP (already set): ${contact.name} @ ${name} already has warmPath="${contact.warmPath}"`);
        skippedAlreadySet++;
        continue;
      }
      await prisma.contact.update({ where: { id: contact.id }, data: { warmPath: intro } });
      console.log(`SET: ${contact.name} @ ${name} -> warmPath="${intro}"`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} contacts. Skipped ${skippedAlreadySet} already-set. ${companiesWithNoContacts} matched companies had zero contacts.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
