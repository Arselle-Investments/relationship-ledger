import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { normalizeCompanyName } from "@/lib/company-match";

const schema = z.object({ org: z.string().trim().min(1) });

/** Records that an org string on the New Companies queue was reviewed and doesn't need its own Company record. */
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
  const orgKey = normalizeCompanyName(parsed.data.org);
  await prisma.newCompanyDismissal.upsert({ where: { orgKey }, update: {}, create: { orgKey } });
  return NextResponse.json({ ok: true });
}
