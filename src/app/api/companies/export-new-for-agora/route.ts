import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

/**
 * Companion to /api/contacts/export-new-for-agora, same convention: exports
 * every company added here since the last time this ran, for hand-import
 * into Agora, then marks them exported so re-running only ever picks up
 * what's genuinely new. Column headers are a placeholder using our own field
 * names; expect to adjust once we see Agora's actual expected import format.
 *
 * Optional ?days=N narrows this to companies added in the last N days.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : null;
  const since = days && Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 86_400_000) : null;

  const companies = await prisma.company.findMany({
    where: { agoraExportedAt: null, ...(since ? { createdAt: { gte: since } } : {}) },
    orderBy: { createdAt: "asc" },
  });

  if (companies.length === 0) {
    return NextResponse.json(
      { error: since ? "No new companies in that window." : "No new companies since the last Agora export." },
      { status: 400 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("New Companies");
  sheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Type", key: "type", width: 18 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "City", key: "city", width: 18 },
    { header: "Website", key: "website", width: 28 },
    { header: "LinkedIn", key: "linkedinUrl", width: 30 },
    { header: "AUM", key: "aum", width: 14 },
    { header: "Founded", key: "founded", width: 10 },
    { header: "Target Asset Classes", key: "targetAssetClasses", width: 30 },
    { header: "Added to Ledger", key: "createdAt", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const c of companies) {
    sheet.addRow({
      name: safeCell(c.name),
      type: CONTACT_TYPE_LABELS[c.type],
      tier: c.tier ? CONTACT_TIER_LABELS[c.tier] : "",
      city: safeCell(c.city ?? ""),
      website: safeCell(c.website ?? ""),
      linkedinUrl: safeCell(c.linkedinUrl ?? ""),
      aum: safeCell(c.aum ?? ""),
      founded: safeCell(c.founded ?? ""),
      targetAssetClasses: safeCell(c.targetAssetClasses.join(", ")),
      createdAt: c.createdAt.toISOString().slice(0, 10),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  await prisma.company.updateMany({
    where: { id: { in: companies.map((c) => c.id) } },
    data: { agoraExportedAt: new Date() },
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-new-companies-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
