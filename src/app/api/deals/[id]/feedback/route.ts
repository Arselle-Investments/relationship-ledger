import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { FundraisingStage } from "@prisma/client";

const schema = z.object({
  companyId: z.string().trim().optional().nullable(),
  contactId: z.string().trim().optional().nullable(),
  status: z.nativeEnum(FundraisingStage).default(FundraisingStage.NOT_STARTED),
  notes: z.string().trim().min(1, "Notes are required."),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const deal = await prisma.deal.findUnique({ where: { id } });
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  if (!parsed.data.companyId && !parsed.data.contactId) {
    return NextResponse.json({ error: "Pick a company or a contact for this feedback." }, { status: 400 });
  }

  const feedback = await prisma.dealFeedback.create({
    data: {
      dealId: id,
      companyId: parsed.data.companyId || null,
      contactId: parsed.data.contactId || null,
      status: parsed.data.status,
      notes: parsed.data.notes,
      source: "MANUAL",
      createdByName: actingUser.name,
    },
    include: { company: true, contact: true },
  });
  return NextResponse.json({ feedback }, { status: 201 });
}
