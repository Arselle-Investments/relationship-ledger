import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FundraisingStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { recordStageChange } from "@/lib/stage-history";
import { validateStatusNoteRule } from "@/lib/contact-schema";

const schema = z.object({
  contactIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one contact."),
  status: z.nativeEnum(FundraisingStage),
  note: z.string().trim().optional().default(""),
  closeProbability: z.number().int().min(1).max(5).optional(),
});

/**
 * Moves several contacts to the same funnel stage in one action — the
 * Funnel view's "select a few, move them together" case, where doing each
 * one through its own contact card would be tedious for what's really one
 * decision applied to a group. Same note rule as a single-contact stage
 * change: anything other than Not started needs a reason, since one bulk
 * note has to make sense for every contact it's applied to.
 */
export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { contactIds, status, note, closeProbability } = parsed.data;

  const contacts = await prisma.contact.findMany({ where: { id: { in: contactIds } } });
  if (contacts.length === 0) {
    return NextResponse.json({ error: "No matching contacts found." }, { status: 404 });
  }

  const changing = contacts.filter((c) => c.status !== status);
  if (changing.length > 0) {
    const noteError = validateStatusNoteRule({ previousStatus: changing[0].status, nextStatus: status, notes: note });
    if (noteError) return NextResponse.json({ error: noteError }, { status: 400 });
  }

  await prisma.$transaction(
    changing.map((c) =>
      prisma.contact.update({
        where: { id: c.id },
        data: { status, ...(note ? { notes: note } : {}), ...(closeProbability !== undefined ? { closeProbability } : {}) },
      })
    )
  );
  await Promise.all(
    changing.map((c) =>
      recordStageChange({
        contactId: c.id,
        fromStatus: c.status,
        toStatus: status,
        note: note || `Moved to ${status} as part of a bulk update.`,
        changedByName: actingUser.name,
      })
    )
  );

  return NextResponse.json({ moved: changing.length, unchanged: contacts.length - changing.length });
}
