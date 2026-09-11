import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { AuthError, requireEditor } from "@/lib/permissions";
import { getSettings, updateSettings } from "@/lib/settings";
import { AGORA_TEMPLATE_HEADERS, isKnownAgoraTemplateHeader } from "@/lib/agora-export-template";

/**
 * Lets an admin upload a revised copy of Agora's own "Import/Update
 * Contacts" template whenever Agora adds or renames a custom field, so the
 * export column layout can be updated here without a code deploy. Only the
 * header row (row 1) is read and saved — every export route then builds its
 * columns from this instead of the hardcoded default. A header we don't
 * already have a value mapping for still gets its own column in every
 * export; it's just sent blank until a developer wires up its real source.
 */
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
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "No sheet found in that file." }, { status: 400 });
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    const value = String(cell.value ?? "").trim();
    if (value) headers.push(value);
  });

  if (headers.length === 0) {
    return NextResponse.json({ error: "No header row found in that file." }, { status: 400 });
  }

  await updateSettings({ agoraContactTemplateHeaders: headers });

  const newHeaders = headers.filter((h) => !isKnownAgoraTemplateHeader(h));
  const droppedHeaders = AGORA_TEMPLATE_HEADERS.filter((h) => !headers.includes(h));

  return NextResponse.json({ headers, newHeaders, droppedHeaders });
}

/** Resets the export template back to the built-in default header list. */
export async function DELETE() {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await updateSettings({ agoraContactTemplateHeaders: null });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const settings = await getSettings();
  const headers = (settings.agoraContactTemplateHeaders as string[] | null) ?? null;
  return NextResponse.json({
    headers: headers ?? AGORA_TEMPLATE_HEADERS,
    isCustom: headers != null,
    newHeaders: headers ? headers.filter((h) => !isKnownAgoraTemplateHeader(h)) : [],
  });
}
