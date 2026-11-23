import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Contact, FundraisingStage, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { CONTACT_TYPE_LABELS, mergeStageLabels } from "@/lib/contact-constants";
import { FUNDRAISING_STAGES } from "@/lib/funnel";
import { buildFundInvestors, individualKey, isFundProspect } from "@/lib/fund-investors";
import { safeCell } from "@/lib/excel-safety";

type ContactWithOwner = Contact & { owner: User | null };

type Row = {
  status: FundraisingStage;
  investor: string;
  kind: string;
  type: string;
  contacts: string;
  owners: string;
  commitment: number | null;
  probability: number | null;
  agoraLow: number | null;
  agoraHigh: number | null;
  location: string;
};

const DOLLARS = '"$"#,##0';
const unique = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.filter((v): v is string => !!v && !!v.trim()))).join(", ");
const minOf = (values: (number | null)[]) => {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.min(...nums) : null;
};
const maxOf = (values: (number | null)[]) => {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.max(...nums) : null;
};
const place = (c: Pick<Contact, "city" | "state">) => [c.city, c.state].filter(Boolean).join(", ");

/**
 * Excel download of the AREF I funnel as it shows by default: Fund prospects
 * only, each investing entity (or company) counted once at its rolled-up
 * stage, plus people counted on their own — the same rows and the same
 * estimated/final commitment amounts the Funnel page totals, so the sheet's
 * totals match the page's.
 */
export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [contacts, companies, settings, commitments] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true } }),
    prisma.company.findMany({
      where: {
        OR: [{ recordContexts: { has: "FUND" } }, { contacts: { some: { recordContexts: { has: "FUND" } } } }],
      },
    }),
    getSettings(),
    prisma.entityCommitment.findMany({ where: { amount: { not: null } } }),
  ]);
  const labels = mergeStageLabels(settings.funnelStageLabels as Partial<Record<FundraisingStage, string>> | null);
  const amounts = new Map(commitments.map((c) => [c.key, c.amount as number]));
  const stageOrder = new Map(FUNDRAISING_STAGES.map((s, i) => [s, i]));

  const investors = buildFundInvestors(companies, contacts as ContactWithOwner[]);
  const nested = new Set(investors.flatMap((inv) => inv.contacts.map((c) => c.id)));

  const rows: Row[] = [
    ...investors.map((inv) => ({
      status: inv.status,
      investor: inv.name,
      kind: inv.kind === "company" ? "Company" : "Investing entity",
      type: CONTACT_TYPE_LABELS[inv.type],
      contacts: unique(inv.contacts.map((c) => c.name)),
      owners: unique(inv.contacts.map((c) => c.owner?.name)),
      commitment: amounts.get(inv.key) ?? null,
      probability: maxOf(inv.contacts.map((c) => c.closeProbability)),
      agoraLow: minOf(inv.contacts.map((c) => c.commitmentLow)),
      agoraHigh: maxOf(inv.contacts.map((c) => c.commitmentHigh)),
      location: unique(inv.contacts.map(place)),
    })),
    ...(contacts as ContactWithOwner[])
      .filter((c) => isFundProspect(c) && !nested.has(c.id))
      .map((c) => ({
        status: c.status,
        investor: c.investingEntity?.trim() || c.name,
        kind: "Individual",
        type: CONTACT_TYPE_LABELS[c.type],
        contacts: c.name,
        owners: c.owner?.name ?? "",
        commitment: amounts.get(individualKey(c)) ?? null,
        probability: c.closeProbability,
        agoraLow: c.commitmentLow,
        agoraHigh: c.commitmentHigh,
        location: place(c),
      })),
  ]
    // Only the stages the Funnel shows (a retired stage still in the
    // database, like Initial Interest, isn't counted there either).
    .filter((r) => stageOrder.has(r.status))
    .sort(
      (a, b) =>
        stageOrder.get(a.status)! - stageOrder.get(b.status)! ||
        (b.commitment ?? 0) - (a.commitment ?? 0) ||
        a.investor.localeCompare(b.investor)
    );

  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Funnel");
  sheet.columns = [
    { header: "Stage", key: "stage", width: 24 },
    { header: "Investor", key: "investor", width: 30 },
    { header: "Kind", key: "kind", width: 16 },
    { header: "Type", key: "type", width: 22 },
    { header: "Contacts", key: "contacts", width: 34 },
    { header: "Owner", key: "owners", width: 20 },
    { header: "Commitment", key: "commitment", width: 16 },
    { header: "Commitment Basis", key: "basis", width: 16 },
    { header: "Close Probability (%)", key: "probability", width: 12 },
    { header: "Agora Range Low", key: "agoraLow", width: 16 },
    { header: "Agora Range High", key: "agoraHigh", width: 16 },
    { header: "Location", key: "location", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) {
    sheet.addRow({
      stage: labels[r.status],
      investor: safeCell(r.investor),
      kind: r.kind,
      type: r.type,
      contacts: safeCell(r.contacts),
      owners: safeCell(r.owners),
      commitment: r.commitment,
      basis: r.commitment == null ? "" : r.status === FundraisingStage.COMMITTED ? "Final" : "Estimated",
      probability: r.probability,
      agoraLow: r.agoraLow,
      agoraHigh: r.agoraHigh,
      location: safeCell(r.location),
    });
  }
  for (const key of ["commitment", "agoraLow", "agoraHigh"]) sheet.getColumn(key).numFmt = DOLLARS;
  sheet.autoFilter = { from: "A1", to: "L1" };

  // Same totals the Funnel page shows: each stage's sum, and the overall sum.
  const totals = workbook.addWorksheet("Totals by Stage");
  totals.columns = [
    { header: "Stage", key: "stage", width: 26 },
    { header: "Investors", key: "count", width: 12 },
    { header: "With a Commitment", key: "withAmount", width: 18 },
    { header: "Commitment Total", key: "total", width: 18 },
    { header: "Basis", key: "basis", width: 12 },
  ];
  totals.getRow(1).font = { bold: true };
  let grandCount = 0;
  let grandTotal = 0;
  for (const status of FUNDRAISING_STAGES) {
    const inStage = rows.filter((r) => r.status === status);
    const total = inStage.reduce((sum, r) => sum + (r.commitment ?? 0), 0);
    grandCount += inStage.length;
    grandTotal += total;
    totals.addRow({
      stage: labels[status],
      count: inStage.length,
      withAmount: inStage.filter((r) => r.commitment != null).length,
      total,
      basis: status === FundraisingStage.COMMITTED ? "Final" : "Estimated",
    });
  }
  const totalRow = totals.addRow({ stage: "All stages", count: grandCount, total: grandTotal });
  totalRow.font = { bold: true };
  totals.getColumn("total").numFmt = DOLLARS;

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-aref-funnel-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
