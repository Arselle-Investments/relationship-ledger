import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { mailingListInputSchema } from "@/lib/mailing-list-schema";
import { computeListContacts } from "@/lib/mailing-lists";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const list = await prisma.mailingList.findUnique({ where: { id } });
  if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });
  const contacts = await computeListContacts(list);
  return NextResponse.json({ list, contacts });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  const existing = await prisma.mailingList.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "List not found." }, { status: 404 });

  const body = await req.json();
  const parsed = mailingListInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const list = await prisma.mailingList.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.mode !== undefined ? { mode: data.mode } : {}),
      ...(data.contactIds !== undefined ? { contactIds: data.contactIds } : {}),
      ...(data.filterType !== undefined ? { filterType: data.filterType || null } : {}),
      ...(data.filterTier !== undefined ? { filterTier: data.filterTier || null } : {}),
      ...(data.filterOwnerId !== undefined ? { filterOwnerId: data.filterOwnerId || null } : {}),
      ...(data.filterTag !== undefined ? { filterTag: data.filterTag || null } : {}),
      ...(data.filterStatus !== undefined ? { filterStatus: data.filterStatus || null } : {}),
    },
  });
  const contacts = await computeListContacts(list);
  return NextResponse.json({ list, contacts });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const { id } = await params;
  await prisma.mailingList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
