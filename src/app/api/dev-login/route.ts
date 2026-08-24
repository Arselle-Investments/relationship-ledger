import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { DEV_TEAM } from "@/lib/dev-team";

// Dev-only convenience so the team can preview the app before the real Entra
// ID app registration exists. Creates a real database session directly,
// bypassing OAuth. Never available when NODE_ENV === "production".

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }

  const { name } = await req.json();
  const member = DEV_TEAM.find((m) => m.name === name);
  if (!member) return NextResponse.json({ error: "Unknown team member." }, { status: 400 });

  const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  const user = await prisma.user.upsert({
    where: { email: member.email },
    update: {},
    create: { email: member.email, name: member.name, role: adminCount === 0 ? Role.ADMIN : Role.VIEWER },
  });

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    expires,
    path: "/",
  });
  return res;
}
