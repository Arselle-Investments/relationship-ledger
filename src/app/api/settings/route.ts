import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

const schema = z.object({
  defaultCadenceDays: z.number().int().positive().optional(),
  staleDays: z.number().int().positive().optional(),
  stuckDays: z.number().int().positive().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const settings = await updateSettings(parsed.data);
  return NextResponse.json({ settings });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
