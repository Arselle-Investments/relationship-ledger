import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { CorrespondenceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as CorrespondenceStatus | null;
  const contactId = searchParams.get("contactId");

  const correspondence = await prisma.correspondence.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(contactId ? { contactId } : {}),
    },
    orderBy: { receivedAt: "desc" },
  });
  return NextResponse.json({ correspondence });
}
