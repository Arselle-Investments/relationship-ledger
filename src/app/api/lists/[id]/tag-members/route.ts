import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { tagContactsForList } from "@/lib/list-tagging";

/**
 * Tags every current member of this list with the list's own name, so Agora
 * (which only reads Contact.tags, not this app's lists) can see who's on it.
 * Safe to re-run any time — e.g. after a smart list's membership grows, or
 * to retroactively tag a list that predates this feature.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const list = await prisma.mailingList.findUnique({ where: { id } });
  if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });

  const { tagged, alreadyTagged } = await tagContactsForList(list, actingUser);
  return NextResponse.json({ tagged, alreadyTagged });
}
