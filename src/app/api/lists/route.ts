import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { mailingListInputSchema } from "@/lib/mailing-list-schema";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const lists = await prisma.mailingList.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ lists });
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }

  const body = await req.json();
  const parsed = mailingListInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const list = await prisma.mailingList.create({
    data: {
      name: data.name,
      description: data.description || null,
      mode: data.mode,
      contactIds: data.contactIds,
      filterType: data.filterType || null,
      filterTier: data.filterTier || null,
      filterOwnerId: data.filterOwnerId || null,
      filterTag: data.filterTag || null,
      filterStatus: data.filterStatus || null,
    },
  });
  return NextResponse.json({ list }, { status: 201 });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
