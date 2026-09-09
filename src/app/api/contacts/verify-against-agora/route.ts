import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { parseFirstSheet } from "@/lib/excel-import";
import { buildAgoraContact } from "@/lib/agora-import";
import { Contact } from "@prisma/client";

/**
 * Read-only diff against a fresh Agora export — for the fields "Import from
 * Agora" deliberately leaves alone (org, phone, city, notes), since those are
 * the ones a team member might have corrected by hand. This route never
 * writes anything; it just reports where the file and the Ledger disagree,
 * so a human can apply exactly the changes that make sense, field by field,
 * from the review modal. Distinct from both the everyday sync (which only
 * touches Agora-owned fields) and "Replace all" (which rebuilds the whole
 * roster) — this is for "we just fixed some of these in Agora, does the
 * Ledger agree now."
 */

type FieldKey = "org" | "phone" | "city" | "notes";
const FIELDS: FieldKey[] = ["org", "phone", "city", "notes"];

function normalized(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const rows = await parseFirstSheet(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found in that file." }, { status: 400 });
  }

  const users = await prisma.user.findMany();
  const userByName = new Map(users.map((u) => [(u.name ?? "").toLowerCase(), u]));

  const existingContacts = await prisma.contact.findMany({ where: { email: { not: null } } });
  const existingByEmail = new Map(existingContacts.map((c) => [c.email!.toLowerCase(), c]));

  let matched = 0;
  const withChanges: {
    contactId: string;
    name: string;
    diffs: { field: FieldKey; label: string; current: string | null; proposed: string }[];
  }[] = [];
  const seen = new Set<string>();

  const FIELD_LABELS: Record<FieldKey, string> = {
    org: "Organization",
    phone: "Phone",
    city: "City",
    notes: "Notes",
  };

  for (const row of rows) {
    const built = buildAgoraContact(row, userByName);
    if (!built || !built.email) continue;

    const existing = existingByEmail.get(built.email.toLowerCase());
    if (!existing || seen.has(existing.id)) continue;
    seen.add(existing.id);
    matched++;

    const diffs: { field: FieldKey; label: string; current: string | null; proposed: string }[] = [];
    for (const field of FIELDS) {
      const proposed = normalized(built[field] as string | null);
      if (!proposed) continue;
      const current = (existing as Contact)[field] as string | null;
      if (normalized(current) !== proposed) {
        diffs.push({ field, label: FIELD_LABELS[field], current, proposed });
      }
    }
    if (diffs.length > 0) {
      withChanges.push({ contactId: existing.id, name: existing.name, diffs });
    }
  }

  return NextResponse.json({ checked: rows.length, matched, withChanges });
}
