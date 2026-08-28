import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { draftTravelOutreachEmail } from "@/lib/ai";

const schema = z.object({ contactIds: z.array(z.string()).min(1).max(25) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const trip = await prisma.travel.findUnique({ where: { id }, include: { user: true } });
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const contacts = await prisma.contact.findMany({ where: { id: { in: parsed.data.contactIds } } });
  const startDate = trip.startDate.toISOString().slice(0, 10);
  const endDate = trip.endDate.toISOString().slice(0, 10);
  const travelerName = trip.user.name || trip.user.email || "the team";

  try {
    const drafts = await Promise.all(
      contacts.map(async (c) => ({
        contactId: c.id,
        draft: await draftTravelOutreachEmail({
          contactName: c.name,
          contactOrg: c.org,
          travelerName,
          city: trip.city,
          startDate,
          endDate,
        }),
      }))
    );
    return NextResponse.json({ drafts });
  } catch (e) {
    console.error("Failed to draft travel outreach", e);
    return NextResponse.json({ error: "Couldn't reach the AI drafting service. Check the Anthropic account's credit balance and try again." }, { status: 502 });
  }
}
