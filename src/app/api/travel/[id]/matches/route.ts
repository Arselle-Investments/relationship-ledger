import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { getMatchingCompanies, getMatchingContacts } from "@/lib/travel";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const trip = await prisma.travel.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const [contacts, companies] = await Promise.all([
    getMatchingContacts(trip.city),
    getMatchingCompanies(trip.city),
  ]);
  return NextResponse.json({ contacts, companies });
}
