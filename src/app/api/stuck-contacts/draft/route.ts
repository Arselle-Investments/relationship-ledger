import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { draftCheckInEmail } from "@/lib/ai";

const schema = z.object({ contactIds: z.array(z.string()).min(1).max(25) });

export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const contacts = await prisma.contact.findMany({ where: { id: { in: parsed.data.contactIds } } });

  const drafts = await Promise.all(
    contacts.map(async (c) => {
      const latestChange = await prisma.contactStatusChange.findFirst({
        where: { contactId: c.id },
        orderBy: { createdAt: "desc" },
      });
      const enteredAt = latestChange?.createdAt ?? c.createdAt;
      const daysInStage = Math.round((Date.now() - enteredAt.getTime()) / 86_400_000);
      const draft = await draftCheckInEmail({
        name: c.name,
        org: c.org,
        status: c.status,
        daysInStage,
        notes: c.notes,
      });
      return { contactId: c.id, draft };
    })
  );

  return NextResponse.json({ drafts });
}
