import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { safeCell } from "@/lib/excel-safety";

const schema = z.object({ companyIds: z.array(z.string()).min(1, "Select at least one company.") });

/**
 * Exports whatever set of companies the Companies view currently has
 * filtered to (e.g. Source: AREF I Tracker + not yet in Agora) — a plain
 * read-only review export, not tied to Agora's export-and-mark-sent flow.
 * Filtering already happens client-side against data already in the
 * browser, so this just takes the resulting IDs rather than re-deriving
 * the filter server-side.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: parsed.data.companyIds } },
    orderBy: { name: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Companies");
  sheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Type", key: "type", width: 18 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Sources", key: "sources", width: 26 },
    { header: "City", key: "city", width: 18 },
    { header: "Website", key: "website", width: 28 },
    { header: "Target Asset Classes", key: "targetAssetClasses", width: 30 },
    { header: "In Agora?", key: "inAgora", width: 12 },
    { header: "Agora Exported", key: "agoraExportedAt", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const c of companies) {
    sheet.addRow({
      name: safeCell(c.name),
      type: CONTACT_TYPE_LABELS[c.type],
      tier: c.tier ? CONTACT_TIER_LABELS[c.tier] : "",
      sources: safeCell(c.sources.join(", ")),
      city: safeCell(c.city ?? ""),
      website: safeCell(c.website ?? ""),
      targetAssetClasses: safeCell(c.targetAssetClasses.join(", ")),
      inAgora: c.agoraExportedAt ? "Yes" : "No",
      agoraExportedAt: c.agoraExportedAt ? c.agoraExportedAt.toISOString().slice(0, 10) : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-companies-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
