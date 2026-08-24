import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/permissions";
import { Role } from "@prisma/client";

const schema = z.object({ role: z.nativeEnum(Role) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  if (id === admin.id && parsed.data.role !== Role.ADMIN) {
    const otherAdmins = await prisma.user.count({ where: { role: Role.ADMIN, id: { not: id } } });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "You can't remove the last admin." }, { status: 400 });
    }
  }

  const user = await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });
  return NextResponse.json({ user });
}
