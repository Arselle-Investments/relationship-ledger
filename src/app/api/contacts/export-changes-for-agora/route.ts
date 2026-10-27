import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { AGORA_TEMPLATE_HEADERS, buildAgoraContactRow } from "@/lib/agora-export-template";
import { agoraSyncState, isExportableToAgora } from "@/lib/agora-sync";
import { getAgoraListColumnMappings } from "@/lib/mailing-lists";
import { getSettings } from "@/lib/settings";

/**
 * Companion to export-new-for-agora, for contacts Agora *already* knows
 * about (agoraExportedAt set) that have been touched at all since they were
 * last sent — i.e. updatedAt is newer than agoraChangesSyncedAt (or, if
 * they've never been change-synced, agoraExportedAt). Deliberately not a
 * whitelist of "tracked" fields or an Edit Log lookup: every field that
 * feeds the Agora template (stage, Fund/Deal, Do Not Contact, type, tier,
 * state, tags, ...) has to be able to trigger a re-send, and plenty of paths
 * (funnel stage drags, bulk updates, one-off scripts) change those without
 * ever writing an Edit Log row. Marks each included contact's
 * agoraChangesSyncedAt so re-running only picks up what's changed since this
 * run.
 *
 * Uses Agora's own contact template (same as export-new-for-agora), matched
 * on Email, and fills every column with the contact's full current data
 * rather than just the changed field(s). Per Agora's own import docs, a
 * blank cell on an update import keeps the existing value by default (it is
 * never cleared) — so a full row is not strictly required, but sending it
 * anyway keeps this one code path correct regardless of that default ever
 * changing, and costs nothing since we already have every field on hand.
 */
export async function POST() {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  // Captured before reading anything, so an edit that lands while this export
  // is being built still has an updatedAt newer than the marker we stamp below
  // and gets picked up next time instead of silently falling through.
  const exportedAt = new Date();

  const candidates = await prisma.contact.findMany({
    where: { agoraExportedAt: { not: null } },
    include: { company: true, owner: true },
  });
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No contacts have been sent to Agora yet." }, { status: 400 });
  }

  const changed = candidates.filter((c) => agoraSyncState(c) === "changed");
  // Agora can't import a contact without a real email, so those are held back
  // (and left unstamped, so they're picked up once the email is fixed) — same
  // rule as the new-contacts and full-database exports.
  const toExport = changed.filter(isExportableToAgora);
  const skipped = changed.length - toExport.length;
  if (toExport.length === 0) {
    return NextResponse.json(
      {
        error:
          changed.length === 0
            ? "No contact changes since the last export."
            : `${changed.length} contact${changed.length === 1 ? "" : "s"} changed, but none have a real email on file — see Data Hygiene.`,
      },
      { status: 400 }
    );
  }

  const settings = await getSettings();
  const headers = (settings.agoraContactTemplateHeaders as string[] | null) ?? AGORA_TEMPLATE_HEADERS;
  const listMappings = await getAgoraListColumnMappings();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };
  for (const c of toExport) {
    sheet.addRow(buildAgoraContactRow(c, c.company, headers, listMappings, c.owner));
  }
  sheet.columns.forEach((col) => (col.width = 20));

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const fileName = `arselle-contact-changes-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx`;

  await prisma.$transaction([
    // Raw on purpose: updateMany would bump @updatedAt past the marker and
    // flag every contact in this batch as "changed" again on the next run.
    prisma.$executeRaw`UPDATE "Contact" SET "agoraChangesSyncedAt" = ${exportedAt} WHERE "id" IN (${Prisma.join(toExport.map((c) => c.id))})`,
    prisma.agoraExportLog.create({
      data: {
        kind: "contacts-changes",
        fileName,
        fileData: buffer,
        recordCount: toExport.length,
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
