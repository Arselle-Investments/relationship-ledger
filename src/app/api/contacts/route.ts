import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { contactInputSchema, validateStatusNoteRule } from "@/lib/contact-schema";
import { buildContactWhere } from "@/lib/contact-query";
import { recordStageChange } from "@/lib/stage-history";
import { FundraisingStage } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }

  const { searchParams } = new URL(req.url);
  const where = buildContactWhere(searchParams);

  const contacts = await prisma.contact.findMany({
    where,
    include: { owner: true, warmPath: true, company: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }

  const body = await req.json();
  const parsed = contactInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const noteError = validateStatusNoteRule({
    previousStatus: null,
    nextStatus: data.status,
    notes: data.notes,
  });
  if (noteError) {
    return NextResponse.json({ error: noteError }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      name: data.name,
      org: data.org || null,
      type: data.type,
      tier: data.tier,
      status: data.status,
      ownerId: data.ownerId || actingUser.id,
      warmPathId: data.warmPathId || null,
      email: data.email || null,
      phone: data.phone || null,
      city: data.city || null,
      lastContact: data.lastContact ? new Date(data.lastContact) : new Date(),
      cadenceOverrideDays: data.cadenceOverrideDays ?? null,
      priorityQuarter: data.priorityQuarter || null,
      tags: data.tags,
      notes: data.notes ?? "",
      closeProbability: data.closeProbability ?? null,
    },
    include: { owner: true, warmPath: true, company: true },
  });

  if (data.status !== FundraisingStage.NOT_STARTED) {
    await recordStageChange({
      contactId: contact.id,
      fromStatus: null,
      toStatus: data.status,
      note: data.notes ?? "",
      changedByName: actingUser.name,
    });
  }

  return NextResponse.json({ contact }, { status: 201 });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
