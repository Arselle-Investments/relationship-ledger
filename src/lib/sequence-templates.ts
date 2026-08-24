import { prisma } from "@/lib/prisma";
import { STARTER_TEMPLATES } from "@/lib/sequence-template-schema";

/** Lazily seeds the two PRD starter templates the first time templates are viewed. */
export async function getSequenceTemplates() {
  const count = await prisma.sequenceTemplate.count();
  if (count === 0) {
    await prisma.sequenceTemplate.createMany({
      data: STARTER_TEMPLATES.map((t) => ({ name: t.name, steps: t.steps })),
    });
  }
  return prisma.sequenceTemplate.findMany({ orderBy: { createdAt: "asc" } });
}
