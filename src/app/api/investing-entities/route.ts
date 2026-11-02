import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";

/** Every Investing Entity name already in use, for the contact form's suggestions. */
export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const rows = await prisma.contact.findMany({
    where: { investingEntity: { not: null } },
    select: { investingEntity: true },
    distinct: ["investingEntity"],
    orderBy: { investingEntity: "asc" },
  });
  return NextResponse.json({ entities: rows.map((r) => r.investingEntity).filter((n): n is string => !!n) });
}
