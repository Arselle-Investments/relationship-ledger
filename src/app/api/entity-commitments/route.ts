import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { logEdit } from "@/lib/edit-log";
import { investorKey } from "@/lib/fund-investors";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  amount: z.number().nonnegative().nullable(),
});

/** Sets (or clears) the estimated commitment for one investor, by name. */
export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, amount } = parsed.data;
  const key = investorKey(name);
  const existing = await prisma.entityCommitment.findUnique({ where: { key } });
  const row = await prisma.entityCommitment.upsert({
    where: { key },
    create: { key, name, amount },
    update: { amount },
  });
  await logEdit({
    entityType: "EntityCommitment",
    entityId: row.id,
    entityLabel: row.name,
    changedById: user.id,
    changedByName: user.name,
    changes: [{ field: "amount", oldValue: existing?.amount ?? null, newValue: amount }],
  });
  return NextResponse.json({ key, amount: row.amount });
}
