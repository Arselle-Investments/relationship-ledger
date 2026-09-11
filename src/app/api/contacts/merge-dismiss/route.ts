import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { groupKeyFor } from "@/lib/contact-dedupe";

const schema = z.object({ contactIds: z.array(z.string().trim().min(1)).min(2) });

/** Records that this exact cluster of contacts was reviewed and confirmed NOT to be duplicates. */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const groupKey = groupKeyFor(parsed.data.contactIds);
  await prisma.contactMergeDismissal.upsert({ where: { groupKey }, update: {}, create: { groupKey } });
  return NextResponse.json({ ok: true });
}
