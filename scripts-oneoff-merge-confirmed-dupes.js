const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// [primaryName, secondaryName, why primary was chosen]
const PAIRS = [
  ["Annie Vartanian", "Ani Vartanian", "the committed $180k AREF I investor record — must not lose status/notes"],
  ["Matt Khourie", "Matt Khoury", "more complete record (already has company link + prior merge history)"],
  ["Ryan Altoon", "Ron Altoon", "has an owner assigned"],
  ["Kevin MacKenzie", "Kevin McKenzie", "has company (JLL) linked"],
];

async function mergeOne(primaryName, secondaryName, why) {
  const primary = await prisma.contact.findFirstOrThrow({ where: { name: primaryName } });
  const secondary = await prisma.contact.findFirstOrThrow({ where: { name: secondaryName } });

  const tags = Array.from(new Set([...primary.tags, ...secondary.tags]));
  const recordContexts = Array.from(new Set([...(primary.recordContexts || []), ...(secondary.recordContexts || [])]));

  const noteLines = [primary.notes?.trim()].filter(Boolean);
  if (secondary.email && secondary.email.toLowerCase() !== (primary.email || "").toLowerCase()) {
    noteLines.push(`Alternate email on a merged duplicate ("${secondary.name}"): ${secondary.email}`);
  }
  noteLines.push(`Merged duplicate "${secondary.name}" into this record (${why}).`);
  const notes = noteLines.join("\n");

  const data = {
    tags,
    recordContexts,
    notes,
    city: primary.city ?? secondary.city,
    state: primary.state ?? secondary.state,
    phone: primary.phone ?? secondary.phone,
    org: primary.org ?? secondary.org,
    companyId: primary.companyId ?? secondary.companyId,
    ownerId: primary.ownerId ?? secondary.ownerId,
    warmPath: primary.warmPath ?? secondary.warmPath,
  };

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { contactId: secondary.id }, data: { contactId: primary.id } });
    await tx.correspondence.updateMany({ where: { contactId: secondary.id }, data: { contactId: primary.id } });
    await tx.contactStatusChange.updateMany({ where: { contactId: secondary.id }, data: { contactId: primary.id } });
    await tx.dealFeedback.updateMany({ where: { contactId: secondary.id }, data: { contactId: primary.id } });
    await tx.contact.update({ where: { id: primary.id }, data });
    await tx.contact.delete({ where: { id: secondary.id } });
  });

  console.log(`Merged "${secondary.name}" into "${primary.name}".`);
}

async function main() {
  for (const [p, s, why] of PAIRS) {
    await mergeOne(p, s, why);
  }
  console.log("\nFinal records:");
  for (const [p] of PAIRS) {
    console.log(await prisma.contact.findFirst({ where: { name: p } }));
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
