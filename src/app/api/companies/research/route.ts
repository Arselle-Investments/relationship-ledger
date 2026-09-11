import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireEditor } from "@/lib/permissions";
import { researchCompany } from "@/lib/ai";

const schema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().optional().nullable(),
});

/**
 * Same idea as /api/contacts/[id]/research, but for a company that doesn't
 * exist as a record yet — used from the New Companies queue to pre-fill a
 * draft (website, AUM, founded, etc.) before it's created, rather than
 * requiring a Company row to exist first.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  let research;
  try {
    research = await researchCompany({ name: parsed.data.name, city: parsed.data.city ?? null });
  } catch (e) {
    console.error("Failed to research company", e);
    return NextResponse.json({ error: "Couldn't reach the AI research service. Check the Anthropic account's credit balance and try again." }, { status: 502 });
  }

  return NextResponse.json({ research });
}
