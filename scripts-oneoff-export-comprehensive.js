const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const CONTACT_TYPE_LABELS = {
  PLACEMENT_AGENT: "Placement Agent", OTHER: "Other", PUBLIC_PENSION_PLAN: "Public Pension Plan",
  PRIVATE_PENSION_PLAN: "Private Pension Plan", INSTITUTIONAL_INVESTOR: "Institutional Investor",
  ENDOWMENT: "Endowment", FOUNDATION: "Foundation", INSURANCE_COMPANY: "Insurance Company",
  SOVEREIGN_WEALTH_FUND: "Sovereign Wealth Fund", SINGLE_FAMILY_OFFICE: "Single Family Office",
  MULTI_FAMILY_OFFICE: "Multi Family Office", WEALTH_MANAGER: "Wealth Manager", HNW: "HNW",
  INDIVIDUAL: "Individual", FAMILY_MEMBER: "Family Member", TRUSTS_TRUSTEE: "Trusts/Trustee",
  PRIVATE_EQUITY_FUND: "Private Equity Fund", FUND_OF_FUNDS: "Fund of Funds", HEDGE_FUND: "Hedge Fund",
  ADVISOR: "Advisor", LAWYER: "Lawyer", SERVICE_PROVIDER: "Service Provider", CRE_SPONSOR: "CRE Sponsor",
  BROKER: "Broker", LENDER: "Lender",
};
const TIER_LABELS = { TIER_1: "Tier 1", TIER_2: "Tier 2", TIER_3: "Tier 3" };
// Same wording as FUNDRAISING_STAGE_LABELS in src/lib/contact-constants.ts (renumbered 2026-11-05).
const STAGE_LABELS = {
  NOT_STARTED: "0. Introduction Pending", OUTREACH_SENT: "1. Outreach Sent", INITIAL_INTEREST: "Initial Interest (retired)",
  MEETING_OCCURRED: "2. Meeting Occurred", ACTIVE_PROSPECT: "3a. Active Prospect",
  FINAL_CLOSE_POTENTIAL: "3b. Final Close Potential", DUE_DILIGENCE: "4. Due Diligence / Dataroom",
  COMMITTED: "5. Committed", PASSED_OPEN: "Fund II Prospect", DECLINE: "Declined",
};
const RECORD_CONTEXT_LABELS = {
  FUND: "Fund", DEAL: "Deal", MGMT_CO: "Mgmt Co",
  PLATFORM_LEVEL_PROPCO: "Platform-Level PropCo", PLATFORM_LEVEL_OPCO: "Platform-Level OpCo",
};
const ASSET_CLASS_LABELS = { INDUSTRIAL: "Industrial", MULTIFAMILY: "Multifamily", RETAIL: "Retail", SELF_STORAGE: "Self Storage", OFFICE: "Office", HOSPITALITY: "Hospitality", LAND: "Land" };
const STRUCTURE_LABELS = { LP_EQUITY: "LP Equity", CO_GP: "Co-GP", STRUCTURED_EQUITY: "Structured Equity", DEBT_CAPITAL: "Debt Capital", OTHER_STRATEGIC: "Other Strategic" };
const STRATEGY_LABELS = { CORE: "Core", CORE_PLUS: "Core-Plus", VALUE_ADD: "Value-Add", OPPORTUNISTIC: "Opportunistic", NNN: "NNN" };
const joinLabels = (values, labels) => (values ?? []).map((v) => labels[v] ?? v).join("; ");

const BOGUS_EMAIL_PATTERNS = [
  /tbd/i, /needsemail/i, /needemail/i, /noemail/i, /no-email/i, /^n\/?a@/i,
  /unknown/i, /placeholder/i, /^test@/i, /@test\./i, /@example\./i, /^none@/i,
  /@none\./i, /(.)\1{4,}@/i, /^n\.?a\.?@/i, /donotcontact/i, /^n_a@/i, /^na@/i,
  /@n-a\./i, /notprovided/i, /notgiven/i, /pending@/i, /@pending\./i, /dummy/i,
  /fake@/i, /sample@/i, /nomail/i, /emailtbd/i, /getemail/i,
];
function isBogusEmail(email) {
  return !!email && BOGUS_EMAIL_PATTERNS.some((pat) => pat.test(email));
}

const dateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

async function main() {
  const outPath = process.argv[2];

  const mailingLists = await p.mailingList.findMany({ where: { filterTag: { not: null } } });

  const contacts = await p.contact.findMany({
    include: {
      company: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
    orderBy: { name: "asc" },
  });
  const companies = await p.company.findMany({
    include: { _count: { select: { contacts: true } } },
    orderBy: { name: "asc" },
  });

  // One Yes/blank column per tag that 2+ contacts share (most-used first), so
  // each can be filtered directly. Tags already covered by a mailing-list
  // column are skipped, and 1-contact tags stay in "Tags (all)" only.
  const mlTagSet = new Set(mailingLists.map((l) => l.filterTag));
  const tagCounts = new Map();
  for (const c of contacts) for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tagColumns = [...tagCounts.entries()]
    .filter(([t, n]) => n >= 2 && !mlTagSet.has(t))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Contacts");

  // Every column below (besides the ID, "Bogus Email?" computed flag, and
  // Created/Updated timestamps) is read back and synced by
  // scripts-oneoff-apply-comprehensive.js — keep the two scripts in lockstep:
  // adding/removing a column here means updating the apply script to match,
  // or a removed column's old value silently never gets cleared/updated.
  const columns = [
    { header: "Contact ID (do not edit)", key: "id", width: 26 },
    { header: "Name", key: "name", width: 26 },
    { header: "Company", key: "company", width: 30 },
    { header: "Investing Entity", key: "investingEntity", width: 28 },
    { header: "Type", key: "type", width: 20 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Status (Funnel)", key: "status", width: 22 },
    { header: "Do Not Contact (Agora: Unsubscribed)", key: "doNotContact", width: 16 },
    { header: "Close Probability (1-5)", key: "closeProbability", width: 12 },
    { header: "Prospect Type", key: "recordContexts", width: 30 },
    { header: "Email", key: "email", width: 30 },
    { header: "Bogus Email? (computed, not editable)", key: "bogus", width: 18 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "City", key: "city", width: 18 },
    { header: "State", key: "state", width: 8 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Warm Path (intermediary/broker)", key: "warmPath", width: 26 },
    { header: "Last Contact", key: "lastContact", width: 12 },
    { header: "Cadence Override (days)", key: "cadenceOverrideDays", width: 12 },
    { header: "Priority Quarter", key: "priorityQuarter", width: 14 },
    { header: "Tags (all)", key: "tags", width: 32 },
    ...mailingLists.map((l) => ({ header: `${l.name} (Mailing List)`, key: `ml_${l.id}`, width: 16 })),
    ...tagColumns.map((t, i) => ({ header: `Tag: ${t}`, key: `tag_${i}`, width: 14 })),
    { header: "Commitment Low ($mm)", key: "commitLow", width: 12 },
    { header: "Commitment High ($mm)", key: "commitHigh", width: 12 },
    // Company-level fields (asset classes, check size, AUM, website…) live on
    // the Organizations tab, one row per company, so two contacts at the same
    // firm can't disagree about them.
    { header: "Research Bio", key: "researchBio", width: 30 },
    { header: "Created (read-only)", key: "createdAt", width: 14 },
    { header: "Updated (read-only)", key: "updatedAt", width: 14 },
  ];
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn("id").font = { color: { argb: "FFAAAAAA" }, size: 9 };
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  for (const c of contacts) {
    const bogus = isBogusEmail(c.email);
    const rowData = {
      id: c.id, name: c.name, company: c.company?.name ?? c.org ?? "", investingEntity: c.investingEntity ?? "",
      type: CONTACT_TYPE_LABELS[c.type] ?? c.type,
      tier: TIER_LABELS[c.tier] ?? c.tier, status: STAGE_LABELS[c.status] ?? c.status,
      doNotContact: c.doNotContact ? "Yes" : "",
      closeProbability: c.closeProbability ?? "",
      recordContexts: joinLabels(c.recordContexts, RECORD_CONTEXT_LABELS),
      email: c.email ?? "", bogus: bogus ? "YES" : "",
      phone: c.phone ?? "", city: c.city ?? "", state: c.state ?? "",
      owner: c.owner?.name || c.owner?.email || "",
      warmPath: c.warmPath ?? "",
      lastContact: dateStr(c.lastContact),
      cadenceOverrideDays: c.cadenceOverrideDays ?? "",
      priorityQuarter: c.priorityQuarter ?? "",
      tags: (c.tags ?? []).join(", "),
      commitLow: c.commitmentLow ?? "", commitHigh: c.commitmentHigh ?? "",
      researchBio: c.researchBio ?? "",
      createdAt: dateStr(c.createdAt), updatedAt: dateStr(c.updatedAt),
    };
    for (const l of mailingLists) {
      rowData[`ml_${l.id}`] = (c.tags ?? []).includes(l.filterTag) ? "Yes" : "";
    }
    tagColumns.forEach((t, i) => {
      rowData[`tag_${i}`] = (c.tags ?? []).includes(t) ? "Yes" : "";
    });
    const row = sheet.addRow(rowData);
    if (bogus) {
      row.getCell("email").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } };
      row.getCell("bogus").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } };
      row.getCell("bogus").font = { color: { argb: "FF990000" }, bold: true };
    }
  }
  sheet.autoFilter = { from: "A1", to: { row: 1, column: columns.length } };

  // One row per organization. Read back by the apply script's Organizations
  // pass — same lockstep rule as the Contacts columns above.
  const orgSheet = wb.addWorksheet("Organizations");
  const orgColumns = [
    { header: "Organization ID (do not edit)", key: "id", width: 26 },
    { header: "Name", key: "name", width: 34 },
    { header: "Type", key: "type", width: 20 },
    { header: "Tier", key: "tier", width: 10 },
    { header: "Status (Funnel)", key: "status", width: 22 },
    { header: "Prospect Type", key: "recordContexts", width: 30 },
    { header: "City", key: "city", width: 18 },
    { header: "Priority Quarter", key: "priorityQuarter", width: 14 },
    { header: "Website", key: "website", width: 28 },
    { header: "LinkedIn", key: "linkedinUrl", width: 28 },
    { header: "AUM", key: "aum", width: 14 },
    { header: "Founded", key: "founded", width: 10 },
    { header: "Target Asset Class", key: "assetClasses", width: 22 },
    { header: "Investment Structures", key: "structures", width: 22 },
    { header: "Investment Strategies", key: "strategies", width: 20 },
    { header: "Check Size Min ($mm)", key: "sizeMin", width: 14 },
    { header: "Check Size Max ($mm)", key: "sizeMax", width: 14 },
    { header: "Tags", key: "tags", width: 32 },
    { header: "Notes", key: "notes", width: 40 },
    { header: "Contacts (read-only)", key: "contactCount", width: 10 },
    { header: "Created (read-only)", key: "createdAt", width: 14 },
    { header: "Updated (read-only)", key: "updatedAt", width: 14 },
  ];
  orgSheet.columns = orgColumns;
  orgSheet.getRow(1).font = { bold: true };
  orgSheet.getColumn("id").font = { color: { argb: "FFAAAAAA" }, size: 9 };
  orgSheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  for (const co of companies) {
    orgSheet.addRow({
      id: co.id, name: co.name.replace(/\s+/g, " ").trim(),
      type: CONTACT_TYPE_LABELS[co.type] ?? co.type,
      tier: TIER_LABELS[co.tier] ?? co.tier ?? "", status: STAGE_LABELS[co.status] ?? co.status,
      recordContexts: joinLabels(co.recordContexts, RECORD_CONTEXT_LABELS),
      city: co.city ?? "", priorityQuarter: co.priorityQuarter ?? "",
      website: co.website ?? "", linkedinUrl: co.linkedinUrl ?? "", aum: co.aum ?? "", founded: co.founded ?? "",
      assetClasses: joinLabels(co.targetAssetClasses, ASSET_CLASS_LABELS),
      structures: joinLabels(co.investmentStructures, STRUCTURE_LABELS),
      strategies: joinLabels(co.investmentStrategies, STRATEGY_LABELS),
      sizeMin: co.investmentSizeMin ?? "", sizeMax: co.investmentSizeMax ?? "",
      tags: (co.tags ?? []).join(", "), notes: co.notes ?? "",
      contactCount: co._count.contacts,
      createdAt: dateStr(co.createdAt), updatedAt: dateStr(co.updatedAt),
    });
  }
  orgSheet.autoFilter = { from: "A1", to: { row: 1, column: orgColumns.length } };

  await wb.xlsx.writeFile(outPath);
  console.log(`Wrote ${contacts.length} contacts (${columns.length} columns) and ${companies.length} organizations to ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
