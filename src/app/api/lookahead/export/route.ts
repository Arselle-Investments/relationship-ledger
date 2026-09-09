import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { getOverdueContacts } from "@/lib/followups";
import { getOverdueSequenceContacts, getUpcomingSequenceItems } from "@/lib/sequences";
import { getUpcomingCadenceContacts, windowBounds } from "@/lib/lookahead";
import { conferenceOverlapsWindow, quarterBounds } from "@/lib/conferences";
import { CONFERENCE_TYPE_LABELS } from "@/lib/conference-constants";
import { DEAL_STATUS_LABELS } from "@/lib/deal-constants";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/task-constants";
import { contactMatchesCity } from "@/lib/travel-match";
import { safeCell } from "@/lib/excel-safety";
import { DealStatus, FundraisingStage, ContactTier } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days");
  const days = daysParam === "30" ? 30 : daysParam === "quarter" ? "quarter" : 14;

  const [contacts, tasks, conferences, travel, settings, activeDeals, stalledConsultants, stalledCapitalSources, tier1Companies, arefTargetContacts] =
    await Promise.all([
      prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
      prisma.task.findMany({ include: { owner: true, contact: true } }),
      prisma.conference.findMany(),
      prisma.travel.findMany({ include: { user: true } }),
      getSettings(),
      prisma.deal.findMany({ where: { status: { in: [DealStatus.ACTIVE, DealStatus.UNDER_CONTRACT] } }, orderBy: { updatedAt: "desc" } }),
      prisma.consultant.findMany({ where: { outreachStatus: FundraisingStage.OUTREACH_SENT }, orderBy: { updatedAt: "desc" } }),
      prisma.capitalSource.findMany({ where: { outreachStatus: FundraisingStage.OUTREACH_SENT }, orderBy: { updatedAt: "desc" } }),
      prisma.company.findMany({ where: { tier: ContactTier.TIER_1 }, orderBy: { name: "asc" } }),
      prisma.contact.findMany({
        where: {
          status: FundraisingStage.NOT_STARTED,
          correspondence: { some: { source: { in: ["aref_import", "capital_partner_untangle"] } } },
        },
        include: { owner: true, warmPath: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const bounds = days === "quarter" ? { start: new Date().toISOString().slice(0, 10), end: quarterBounds(0).end } : windowBounds(days);
  const today = new Date().toISOString().slice(0, 10);

  const requiredCadence = getOverdueContacts(contacts, settings.defaultCadenceDays);
  const requiredSeq = getOverdueSequenceContacts(contacts);
  const recommendedSeq = getUpcomingSequenceItems(contacts, bounds.end);
  const recommendedCadence = getUpcomingCadenceContacts(contacts, settings.defaultCadenceDays, bounds.end);
  const milestones = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate.toISOString().slice(0, 10) <= bounds.end)
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));
  const upcomingConferences = conferences
    .filter((ev) => conferenceOverlapsWindow(ev, bounds))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const upcomingTravel = travel
    .filter((t) => conferenceOverlapsWindow(t, bounds))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const workbook = new ExcelJS.Workbook();

  const requiredSheet = workbook.addWorksheet("Required Follow-ups");
  requiredSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Issue", key: "issue", width: 40 },
  ];
  requiredSheet.getRow(1).font = { bold: true };
  for (const c of requiredCadence) {
    requiredSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      issue: Number.isFinite(c.daysOverdue) ? `${c.daysOverdue + c.cadence}d overdue on cadence` : "no contact on file, overdue on cadence",
    });
  }
  for (const c of requiredSeq) {
    requiredSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      issue: `Sequence step "${c.step.title}" due ${c.step.dueDate}`,
    });
  }

  const recommendedSheet = workbook.addWorksheet("Recommended Outreach");
  recommendedSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Detail", key: "detail", width: 40 },
  ];
  recommendedSheet.getRow(1).font = { bold: true };
  for (const r of recommendedSeq) {
    recommendedSheet.addRow({
      name: safeCell(r.name),
      org: safeCell(r.org ?? ""),
      owner: safeCell(r.owner?.name ?? ""),
      detail: `${r.step.title} due ${r.step.dueDate}`,
    });
  }
  for (const c of recommendedCadence) {
    recommendedSheet.addRow({
      name: safeCell(c.name),
      org: safeCell(c.org ?? ""),
      owner: safeCell(c.owner?.name ?? ""),
      detail: `Cadence follow-up due by ${bounds.end}`,
    });
  }

  const milestonesSheet = workbook.addWorksheet("Milestones");
  milestonesSheet.columns = [
    { header: "Title", key: "title", width: 30 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Due Date", key: "due", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
  ];
  milestonesSheet.getRow(1).font = { bold: true };
  for (const t of milestones) {
    milestonesSheet.addRow({
      title: safeCell(t.title),
      owner: safeCell(t.assigneeLabel ?? t.owner?.name ?? ""),
      due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
      status: TASK_STATUS_LABELS[t.status],
      priority: TASK_PRIORITY_LABELS[t.priority],
    });
  }

  const conferencesSheet = workbook.addWorksheet("Conferences");
  conferencesSheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Start Date", key: "start", width: 14 },
    { header: "End Date", key: "end", width: 14 },
    { header: "Location", key: "location", width: 24 },
    { header: "Type", key: "type", width: 16 },
  ];
  conferencesSheet.getRow(1).font = { bold: true };
  for (const ev of upcomingConferences) {
    conferencesSheet.addRow({
      name: safeCell(ev.name),
      start: ev.startDate.toISOString().slice(0, 10),
      end: ev.endDate.toISOString().slice(0, 10),
      location: safeCell(ev.location ?? ""),
      type: CONFERENCE_TYPE_LABELS[ev.type],
    });
  }

  const travelSheet = workbook.addWorksheet("Team Travel");
  travelSheet.columns = [
    { header: "City", key: "city", width: 22 },
    { header: "Start Date", key: "start", width: 14 },
    { header: "End Date", key: "end", width: 14 },
    { header: "Traveler", key: "traveler", width: 20 },
    { header: "Matching Contacts", key: "matches", width: 18 },
  ];
  travelSheet.getRow(1).font = { bold: true };
  for (const t of upcomingTravel) {
    const matchCount = contacts.filter((c) => contactMatchesCity(c, t.city)).length;
    travelSheet.addRow({
      city: safeCell(t.city),
      start: t.startDate.toISOString().slice(0, 10),
      end: t.endDate.toISOString().slice(0, 10),
      traveler: safeCell(t.user.name ?? t.user.email ?? ""),
      matches: matchCount,
    });
  }

  const dealsSheet = workbook.addWorksheet("Active Deals");
  dealsSheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Asset Class", key: "assetClass", width: 18 },
    { header: "Status", key: "status", width: 16 },
  ];
  dealsSheet.getRow(1).font = { bold: true };
  for (const d of activeDeals) {
    dealsSheet.addRow({ name: safeCell(d.name), assetClass: safeCell(d.assetClass ?? ""), status: DEAL_STATUS_LABELS[d.status] });
  }

  const emSheet = workbook.addWorksheet("EM Needing Follow-up");
  emSheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Type", key: "type", width: 16 },
    { header: "Next Step", key: "nextStep", width: 40 },
  ];
  emSheet.getRow(1).font = { bold: true };
  for (const c of stalledConsultants) {
    emSheet.addRow({ name: safeCell(c.name), type: "Consultant", nextStep: safeCell(c.nextStep ?? "") });
  }
  for (const cs of stalledCapitalSources) {
    emSheet.addRow({ name: safeCell(cs.name), type: "Capital source", nextStep: safeCell(cs.nextStep ?? "") });
  }

  const tier1Sheet = workbook.addWorksheet("Tier 1 Companies");
  tier1Sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "City", key: "city", width: 20 },
  ];
  tier1Sheet.getRow(1).font = { bold: true };
  for (const c of tier1Companies) {
    tier1Sheet.addRow({ name: safeCell(c.name), city: safeCell(c.city ?? "") });
  }

  const arefSheet = workbook.addWorksheet("AREF Targets");
  arefSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Organization", key: "org", width: 26 },
    { header: "Owner", key: "owner", width: 20 },
  ];
  arefSheet.getRow(1).font = { bold: true };
  for (const c of arefTargetContacts) {
    arefSheet.addRow({ name: safeCell(c.name), org: safeCell(c.org ?? ""), owner: safeCell(c.owner?.name ?? "") });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arselle-lookahead-${days === "quarter" ? "quarter" : `${days}d`}-${today}.xlsx"`,
    },
  });
}
