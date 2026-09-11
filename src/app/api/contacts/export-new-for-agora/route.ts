import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { hasRealEmailForAgora } from "@/lib/followups";
import { AGORA_TEMPLATE_HEADERS, buildAgoraContactRow } from "@/lib/agora-export-template";
import { getSettings } from "@/lib/settings";

/**
 * Exports every contact added here since the last time this ran (whether
 * created manually or confirmed from the Inbox), formatted to match Agora's
 * own "Import/Update Contacts" template exactly (see agora-export-template.ts)
 * so the file drops straight into their importer. Marks everything actually
 * included as exported, so re-running this later only ever picks up what's
 * genuinely new.
 *
 * Agora requires a real email on every imported contact — anyone with no
 * email, or one of our historical "needemail@..." placeholders, is held back
 * from the file entirely (and stays "pending" rather than getting marked
 * exported) so they don't silently get skipped or Agora-rejected without a
 * paper trail. They already surface in Data Quality -> Data Hygiene under
 * "No email on file" / "Placeholder email" for the team to fix.
 *
 * Optional ?days=N narrows this to contacts added in the last N days —
 * useful for sending Agora a manageable, recent batch rather than
 * everything that's ever accumulated since the last export.
 */
export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : null;
  const since = days && Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 86_400_000) : null;

  const contacts = await prisma.contact.findMany({
    where: { agoraExportedAt: null, ...(since ? { createdAt: { gte: since } } : {}) },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });

  const exportable = contacts.filter((c) => hasRealEmailForAgora(c.email));
  const skipped = contacts.length - exportable.length;

  if (exportable.length === 0) {
    return NextResponse.json(
      {
        error:
          contacts.length === 0
            ? since
              ? "No new contacts in that window."
              : "No new contacts since the last Agora export."
            : `${contacts.length} contact${contacts.length === 1 ? "" : "s"} pending, but none have a real email on file — see Data Hygiene.`,
      },
      { status: 400 }
    );
  }

  const settings = await getSettings();
  const headers = (settings.agoraContactTemplateHeaders as string[] | null) ?? AGORA_TEMPLATE_HEADERS;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };
  for (const c of exportable) {
    sheet.addRow(buildAgoraContactRow(c, c.company, headers));
  }
  sheet.columns.forEach((col) => (col.width = 20));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const fileName = `arselle-new-contacts-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await prisma.$transaction([
    prisma.contact.updateMany({
      where: { id: { in: exportable.map((c) => c.id) } },
      data: { agoraExportedAt: new Date() },
    }),
    prisma.agoraExportLog.create({
      data: {
        kind: "contacts-new",
        fileName,
        fileData: buffer,
        recordCount: exportable.length,
        skippedCount: skipped,
        createdById: actingUser.id,
        createdByName: actingUser.name,
      },
    }),
  ]);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Skipped-No-Email": String(skipped),
    },
  });
}
