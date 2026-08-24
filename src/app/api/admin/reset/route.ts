import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/permissions";

// Wipes all domain data (contacts, tasks, mailing lists, events) for onboarding
// resets. Never touches User/Account/Session rows, so nobody gets signed out or
// loses their role. Admin-only, and requires the caller to type an exact phrase
// to guard against an accidental click.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "RESET") {
    return NextResponse.json({ error: 'Type "RESET" to confirm.' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.task.deleteMany(),
    prisma.mailingList.deleteMany(),
    prisma.event.deleteMany(),
    prisma.contact.deleteMany(),
  ]);

  return NextResponse.json({ ok: true });
}
