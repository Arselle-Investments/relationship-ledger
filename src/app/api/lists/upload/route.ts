import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { tagContactsForList } from "@/lib/list-tagging";
import { computeListContacts } from "@/lib/mailing-lists";

const EMAIL_ALIASES = ["EMAIL", "EMAIL ADDRESS", "E-MAIL", "E-MAIL ADDRESS"];
const NAME_ALIASES = ["NAME", "FULL NAME", "PROSPECT NAME", "CONTACT NAME"];

/**
 * Creates a brand-new (STATIC) mailing list/campaign from an uploaded
 * spreadsheet of people — each upload is its own list, never merged into an
 * existing one, so re-uploading a refreshed version of the same source list
 * is a new campaign rather than silently changing membership of an old one.
 * Matches rows to existing contacts by email only (the one reliable
 * identifier); rows with no email, or no matching contact, are reported back
 * but never create new contacts here — that's a different, more deliberate
 * flow (Data Quality -> New Contacts).
 */
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
  const name = String(form.get("name") ?? "").trim();
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Give this campaign a name." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "No sheet found in that file." }, { status: 400 });
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim().toUpperCase();
  });
  const emailCol = headers.findIndex((h) => EMAIL_ALIASES.includes(h));
  if (emailCol === -1) {
    return NextResponse.json(
      { error: `No email column found. Expected one of: ${EMAIL_ALIASES.join(", ")}.` },
      { status: 400 }
    );
  }
  const nameCol = headers.findIndex((h) => NAME_ALIASES.includes(h));

  const rows: { email: string; name: string }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const email = String(row.getCell(emailCol).value ?? "").trim();
    const rowName = nameCol !== -1 ? String(row.getCell(nameCol).value ?? "").trim() : "";
    if (email) rows.push({ email, name: rowName });
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows with an email found in that file." }, { status: 400 });
  }

  const emails = Array.from(new Set(rows.map((r) => r.email.toLowerCase())));
  const matchedContacts = await prisma.contact.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
  });
  const byEmail = new Map(matchedContacts.map((c) => [c.email!.toLowerCase(), c]));

  const unmatched = rows.filter((r) => !byEmail.has(r.email.toLowerCase()));
  const contactIds = Array.from(new Set(matchedContacts.map((c) => c.id)));

  if (contactIds.length === 0) {
    return NextResponse.json(
      { error: `None of the ${rows.length} email${rows.length === 1 ? "" : "s"} in that file matched an existing contact.` },
      { status: 400 }
    );
  }

  const list = await prisma.mailingList.create({
    data: {
      name,
      description: `Uploaded ${new Date().toISOString().slice(0, 10)} — ${rows.length} row${rows.length === 1 ? "" : "s"}, ${contactIds.length} matched.`,
      mode: "STATIC",
      contactIds,
    },
  });
  await tagContactsForList(list, actingUser);
  const contacts = await computeListContacts(list);

  return NextResponse.json({
    list,
    contacts,
    matched: contactIds.length,
    totalRows: rows.length,
    unmatched: unmatched.slice(0, 50).map((r) => ({ email: r.email, name: r.name })),
    unmatchedCount: unmatched.length,
  });
}
