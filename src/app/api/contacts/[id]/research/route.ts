import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { researchContact } from "@/lib/ai";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const research = await researchContact({ name: existing.name, org: existing.org, city: existing.city });

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      researchBio: research.bio,
      researchBioSource: research.bioSource,
      researchNews: research.news,
      researchUpdatedAt: new Date(),
    },
    include: { owner: true, warmPath: true },
  });

  return NextResponse.json({ contact });
}
