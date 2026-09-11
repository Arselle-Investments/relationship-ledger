import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { ContactTier } from "@prisma/client";
import { logEdit } from "@/lib/edit-log";

const schema = z.object({
  tier: z.nativeEnum(ContactTier).optional().nullable(),
  priorityQuarter: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  linkedinUrl: z.string().trim().optional().nullable(),
  aum: z.string().trim().optional().nullable(),
  founded: z.string().trim().optional().nullable(),
  targetAssetClasses: z.array(z.string()).optional(),
  investmentStructures: z.array(z.string()).optional(),
  investmentStrategies: z.array(z.string()).optional(),
  investmentSizeMin: z.number().optional().nullable(),
  investmentSizeMax: z.number().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
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
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ("tier" in parsed.data) data.tier = parsed.data.tier || null;
  if ("priorityQuarter" in parsed.data) data.priorityQuarter = parsed.data.priorityQuarter?.trim() || null;
  if ("website" in parsed.data) data.website = parsed.data.website?.trim() || null;
  if ("linkedinUrl" in parsed.data) data.linkedinUrl = parsed.data.linkedinUrl?.trim() || null;
  if ("aum" in parsed.data) data.aum = parsed.data.aum?.trim() || null;
  if ("founded" in parsed.data) data.founded = parsed.data.founded?.trim() || null;
  if ("targetAssetClasses" in parsed.data) data.targetAssetClasses = parsed.data.targetAssetClasses;
  if ("investmentStructures" in parsed.data) data.investmentStructures = parsed.data.investmentStructures;
  if ("investmentStrategies" in parsed.data) data.investmentStrategies = parsed.data.investmentStrategies;
  if ("investmentSizeMin" in parsed.data) data.investmentSizeMin = parsed.data.investmentSizeMin ?? null;
  if ("investmentSizeMax" in parsed.data) data.investmentSizeMax = parsed.data.investmentSizeMax ?? null;

  const company = await prisma.company.update({ where: { id }, data });

  await logEdit({
    entityType: "Company",
    entityId: id,
    entityLabel: company.name,
    changedById: actingUser.id,
    changedByName: actingUser.name,
    changes: Object.keys(data).map((field) => ({
      field,
      oldValue: existing[field as keyof typeof existing],
      newValue: company[field as keyof typeof company],
    })),
  });

  return NextResponse.json({ company });
}
