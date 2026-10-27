import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { AGORA_TEMPLATE_HEADERS, buildAgoraContactRow } from "@/lib/agora-export-template";
import { isExportableToAgora } from "@/lib/agora-sync";
import { getAgoraListColumnMappings } from "@/lib/mailing-lists";
import { getSettings } from "@/lib/settings";

/**
 * Every contact in the Ledger with a real email, as a full current row in
 * Agora's own contact template — new, changed and untouched alike. For when
 * you'd rather re-send the whole database than trust change detection (a
 * template revision, a big cleanup, a first sync after a long gap). Stamps
 * everyone included as synced, so the next "changes" export starts clean, and
 * is logged as its own kind in the export log. Contacts without a real email
 * are held back, same as the new-contacts export, since Agora can't import
 * them.
 */
export async function POST() {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  // Captured before reading anything so an edit landing mid-export still has
  // an updatedAt newer than the marker we stamp below.
  const exportedAt = new Date();

  const contacts = await prisma.contact.findMany({
    include: { company: true, owner: true },
    orderBy: { name: "asc" },
  });
  const exportable = contacts.filter(isExportableToAgora);
  const skipped = contacts.length - exportable.length;
  if (exportable.length === 0) {
    return NextResponse.json({ error: "No contacts with a real email to export." }, { status: 400 });
  }

  const settings = await getSettings();
  const headers = (settings.agoraContactTemplateHeaders as string[] | null) ?? AGORA_TEMPLATE_HEADERS;
  const listMappings = await getAgoraListColumnMappings();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };
  for (const c of exportable) {
    sheet.addRow(buildAgoraContactRow(c, c.company, headers, listMappings, c.owner));
  }
  sheet.columns.forEach((col) => (col.width = 20));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const fileName = `arselle-all-contacts-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await prisma.$transaction([
    // Raw on purpose: updateMany would bump @updatedAt past the markers and
    // make this whole batch look "changed" again on the next run.
    prisma.$executeRaw`UPDATE "Contact" SET "agoraExportedAt" = COALESCE("agoraExportedAt", ${exportedAt}), "agoraChangesSyncedAt" = ${exportedAt} WHERE "id" IN (${Prisma.join(exportable.map((c) => c.id))})`,
    prisma.agoraExportLog.create({
      data: {
        kind: "contacts-full",
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
