import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { CorrespondenceStatus } from "@prisma/client";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), contactId: z.string().min(1) }),
  z.object({
    mode: z.literal("new"),
    name: z.string().trim().min(1, "Name is required."),
    org: z.string().trim().optional().nullable(),
    email: z.string().trim().optional().nullable(),
  }),
]);

/** Confirms a suggested correspondence entry — link it to an existing contact, or create a new one. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const correspondence = await prisma.correspondence.findUnique({ where: { id } });
  if (!correspondence) return NextResponse.json({ error: "Correspondence not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  let contactId: string;
  if (parsed.data.mode === "existing") {
    const contact = await prisma.contact.findUnique({ where: { id: parsed.data.contactId } });
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    contactId = contact.id;
  } else {
    const contact = await prisma.contact.create({
      data: {
        name: parsed.data.name,
        org: parsed.data.org || null,
        email: parsed.data.email || null,
        ownerId: actingUser.id,
        notes: "",
      },
    });
    contactId = contact.id;
  }

  const updated = await prisma.correspondence.update({
    where: { id },
    data: { contactId, status: CorrespondenceStatus.MATCHED },
  });
  return NextResponse.json({ correspondence: updated });
}
