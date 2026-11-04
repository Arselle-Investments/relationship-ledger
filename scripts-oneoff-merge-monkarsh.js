const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PRIMARY_ID = "cmtm03nkc006t10iqm1loedr1"; // Jon Monkarsh
const SECONDARY_ID = "cmtm04dta00le10iqy0pgw7di"; // Monkarsh

async function main() {
  const [primary, secondary] = await Promise.all([
    prisma.contact.findUniqueOrThrow({ where: { id: PRIMARY_ID } }),
    prisma.contact.findUniqueOrThrow({ where: { id: SECONDARY_ID } }),
  ]);

  const tags = Array.from(new Set([...primary.tags, ...secondary.tags]));
  const noteLines = [primary.notes?.trim()].filter(Boolean);
  noteLines.push(`Also known as "${secondary.name}" (merged duplicate) — was Tier 2, city Los Angeles, owner Aaron Greeno.`);
  const notes = noteLines.join("\n");

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { contactId: SECONDARY_ID }, data: { contactId: PRIMARY_ID } });
    await tx.correspondence.updateMany({ where: { contactId: SECONDARY_ID }, data: { contactId: PRIMARY_ID } });
    await tx.contactStatusChange.updateMany({ where: { contactId: SECONDARY_ID }, data: { contactId: PRIMARY_ID } });
    await tx.dealFeedback.updateMany({ where: { contactId: SECONDARY_ID }, data: { contactId: PRIMARY_ID } });

    await tx.contact.update({
      where: { id: PRIMARY_ID },
      data: {
        tags,
        notes,
        tier: "TIER_2", // keep the higher/more specific tier rather than the primary's default TIER_3
      },
    });
    await tx.contact.delete({ where: { id: SECONDARY_ID } });
  });

  console.log("Merged. Final record:");
  console.log(await prisma.contact.findUnique({ where: { id: PRIMARY_ID } }));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
