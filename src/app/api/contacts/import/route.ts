import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { getField, normalizeDate, parseFirstSheet } from "@/lib/excel-import";
import {
  FUNDRAISING_STAGE_BY_LABEL,
  CONTACT_TIER_BY_LABEL,
  CONTACT_TYPE_BY_LABEL,
} from "@/lib/contact-constants";
import { ContactTier, ContactType, FundraisingStage } from "@prisma/client";

export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
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

  const allUsers = await prisma.user.findMany();
  const userByName = new Map(allUsers.map((u) => [u.name?.toLowerCase() ?? "", u]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = getField(row, ["NAME", "CONTACT NAME", "FULL NAME"]);
    if (!name) {
      skipped++;
      continue;
    }
    const org = getField(row, ["ORGANIZATION", "ORG", "COMPANY", "FIRM"]);
    const email = getField(row, ["EMAIL", "EMAIL ADDRESS"]);
    const city = getField(row, ["CITY", "LOCATION", "REGION"]);
    const typeRaw = getField(row, ["TYPE", "CONTACT TYPE", "CATEGORY"]);
    const type: ContactType = CONTACT_TYPE_BY_LABEL[typeRaw.toLowerCase()] ?? ContactType.OTHER;
    const tierRaw = getField(row, ["TIER", "PRIORITY"]);
    const tier: ContactTier = CONTACT_TIER_BY_LABEL[tierRaw.toLowerCase()] ?? ContactTier.TIER_2;
    const ownerRaw = getField(row, ["OWNER", "ASSIGNED TO", "RELATIONSHIP OWNER"]);
    const ownerId = ownerRaw ? userByName.get(ownerRaw.toLowerCase())?.id ?? actingUser.id : actingUser.id;
    const lastContact = normalizeDate(getField(row, ["LAST CONTACT", "LAST CONTACT DATE"])) ?? undefined;
    const statusRaw = getField(row, ["STATUS"]);
    const status: FundraisingStage = FUNDRAISING_STAGE_BY_LABEL[statusRaw.toLowerCase()] ?? FundraisingStage.NOT_STARTED;
    const tags = getField(row, ["TAGS"])
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const notes = getField(row, ["NOTES"]);

    const existing = await prisma.contact.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        org: { equals: org || "", mode: "insensitive" },
      },
    });

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          org: org || existing.org,
          email: email || existing.email,
          city: city || existing.city,
          notes: notes || existing.notes,
        },
      });
      updated++;
    } else {
      await prisma.contact.create({
        data: {
          name,
          org: org || null,
          type,
          tier,
          tags,
          ownerId,
          email: email || null,
          city: city || null,
          lastContact: lastContact ? new Date(lastContact) : new Date(),
          status,
          notes,
        },
      });
      added++;
    }
  }

  return NextResponse.json({ added, updated, skipped });
}
