import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { DEV_TEAM } from "@/lib/dev-team";

// Dev-only convenience so the team can preview the app before the real Entra
// ID app registration exists. Creates a real database session directly,
// bypassing OAuth. Two independent gates guard this: NODE_ENV must not be
// "production", AND ALLOW_DEV_LOGIN must be explicitly set — so a misconfigured
// host (NODE_ENV unset, or set to something like "staging") can't accidentally
// expose an unauthenticated way to mint an admin session.

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
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
