const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CONTACT_TYPE_BY_LABEL = {
  'Placement Agent':'PLACEMENT_AGENT','Other':'OTHER','Public Pension Plan':'PUBLIC_PENSION_PLAN',
  'Private Pension Plan':'PRIVATE_PENSION_PLAN','Institutional Investor':'INSTITUTIONAL_INVESTOR',
  'Endowment':'ENDOWMENT','Foundation':'FOUNDATION','Insurance Company':'INSURANCE_COMPANY',
  'Sovereign Wealth Fund':'SOVEREIGN_WEALTH_FUND','Single Family Office':'SINGLE_FAMILY_OFFICE',
  'Multi Family Office':'MULTI_FAMILY_OFFICE','Wealth Manager':'WEALTH_MANAGER','HNW':'HNW',
  'Individual':'INDIVIDUAL','Family Member':'FAMILY_MEMBER','Trusts/Trustee':'TRUSTS_TRUSTEE',
  'Private Equity Fund':'PRIVATE_EQUITY_FUND','Fund of Funds':'FUND_OF_FUNDS','Hedge Fund':'HEDGE_FUND',
  'Advisor':'ADVISOR','Lawyer':'LAWYER','Service Provider':'SERVICE_PROVIDER','CRE Sponsor':'CRE_SPONSOR',
  'Broker':'BROKER','Lender':'LENDER',
};
const TIER_BY_LABEL = { 'Tier 1':'TIER_1', 'Tier 2':'TIER_2', 'Tier 3':'TIER_3' };
const STAGE_BY_LABEL = {
  'Not started':'NOT_STARTED','1. Outreach Sent':'OUTREACH_SENT','2. Initial Interest':'INITIAL_INTEREST',
  '3. Meeting Occurred':'MEETING_OCCURRED','4a. Active Prospect':'ACTIVE_PROSPECT',
  '4b. Final Close Potential':'FINAL_CLOSE_POTENTIAL','5. Due Diligence / Dataroom':'DUE_DILIGENCE',
  '6. Committed':'COMMITTED','Fund II Prospect':'PASSED_OPEN','Decline':'DECLINE',
  // Old labels for the two stages retired 2026-09-30 in favor of Decline — kept
  // as aliases so a sheet saved before that migration still round-trips
  // instead of trying to write a status value that no longer exists.
  'Passed (not interested)':'DECLINE','Do not contact':'DECLINE',
};
const RC_BY_LABEL = { 'Fund':'FUND','Deal':'DEAL','Mgmt Co':'MGMT_CO','Platform-Level PropCo':'PLATFORM_LEVEL_PROPCO','Platform-Level OpCo':'PLATFORM_LEVEL_OPCO' };
const ASSET_CLASS_BY_LABEL = { 'Industrial':'INDUSTRIAL','Multifamily':'MULTIFAMILY','Retail':'RETAIL','Self Storage':'SELF_STORAGE','Office':'OFFICE','Hospitality':'HOSPITALITY','Land':'LAND' };
const STRUCTURE_BY_LABEL = { 'LP Equity':'LP_EQUITY','Co-GP':'CO_GP','Structured Equity':'STRUCTURED_EQUITY','Debt Capital':'DEBT_CAPITAL','Other Strategic':'OTHER_STRATEGIC' };
const STRATEGY_BY_LABEL = { 'Core':'CORE','Core-Plus':'CORE_PLUS','Value-Add':'VALUE_ADD','Opportunistic':'OPPORTUNISTIC','NNN':'NNN' };

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
  if (typeof v === 'object' && 'richText' in v) return v.richText.map(r => r.text).join('').trim();
  if (v instanceof Date) return v.toISOString().slice(0,10);
  return String(v).trim();
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const sheet = wb.getWorksheet('Contacts');
  const header = sheet.getRow(1).values.map(v => cellText(v));
  const idx = {}; header.forEach((h, i) => { if (h) idx[h] = i; });

  const mailingLists = await prisma.mailingList.findMany({ where: { filterTag: { not: null } } });
  const mlCols = mailingLists.map(l => ({ header: `${l.name} (Mailing List)`, filterTag: l.filterTag }));

  const tagHeaders = Object.keys(idx).filter(h => h.startsWith('Tag: '));

  const rows = [];
  const newRows = [];
  sheet.eachRow((row, rn) => {
    if (rn === 1) return;
    const get = (col) => idx[col] ? cellText(row.getCell(idx[col]).value) : '';
    const id = get('Contact ID (do not edit)');
    const rec = {
      id, name: get('Name'), company: get('Company'), type: get('Type'), tier: get('Tier'), status: get('Status (Funnel)'),
      // undefined (not '') when the sheet predates this column entirely — a
      // missing column must never read as "blank, please clear this field."
      doNotContact: idx['Do Not Contact (Agora: Unsubscribed)'] ? get('Do Not Contact (Agora: Unsubscribed)') : undefined,
      closeProbability: get('Close Probability (1-5)'),
      recordContexts: get('Prospect Type'), email: get('Email'), phone: get('Phone'),
      city: get('City'), state: get('State'), lastContact: get('Last Contact'),
      cadenceOverrideDays: get('Cadence Override (days)'), priorityQuarter: get('Priority Quarter'),
      tags: get('Tags (all)'),
      owner: get('Owner'), warmPath: get('Warm Path (intermediary/broker)'),
      researchBio: get('Research Bio'),
      commitLow: get('Commitment Low ($mm)'), commitHigh: get('Commitment High ($mm)'),
      assetClasses: get('Target Asset Class (Company)'),
      structures: get('Investment Structures (Company)'),
      strategies: get('Investment Strategies (Company)'),
      sizeMin: get('Check Size Min ($mm, Company)'), sizeMax: get('Check Size Max ($mm, Company)'),
      companyAum: get('Company AUM'), companyWebsite: get('Company Website'),
      mlTags: mlCols.filter(m => get(m.header).toLowerCase() === 'yes').map(m => m.filterTag),
      // "Tag: <name>" columns: a Yes adds that tag (additive only, like mailing lists).
      tagColTags: tagHeaders.filter(h => get(h).toLowerCase() === 'yes').map(h => h.slice('Tag: '.length)),
    };
    if (!id) { if (rec.name) newRows.push(rec); return; }
    rows.push(rec);
  });

  console.log('New rows (no ID):', newRows.length);
  newRows.forEach(r => console.log(' ', JSON.stringify(r)));

  const contacts = await prisma.contact.findMany({
    include: { company: { select: { name: true } }, owner: { select: { name: true, email: true } } },
  });
  const byId = new Map(contacts.map(c => [c.id, c]));
  const canonicalTag = new Map();
  for (const c of contacts) for (const t of c.tags || []) canonicalTag.set(t.trim(), t);
  const companies = await prisma.company.findMany();
  const companyByNameLower = new Map(companies.map(co => [co.name.toLowerCase(), co]));
  const companyById = new Map(companies.map(co => [co.id, co]));
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const userByDisplay = new Map();
  for (const u of users) { if (u.name) userByDisplay.set(u.name.toLowerCase(), u); if (u.email) userByDisplay.set(u.email.toLowerCase(), u); }

  let updated = 0;
  const diffs = [];
  for (const r of rows) {
    const c = byId.get(r.id);
    if (!c) continue;
    const data = {};

    if (r.name && r.name !== c.name) data.name = r.name;

    const currentCompanyDisplay = c.company?.name ?? c.org ?? '';
    let targetCompanyId = c.companyId;
    if (r.company && r.company !== currentCompanyDisplay) {
      let match = companyByNameLower.get(r.company.toLowerCase());
      if (!match) {
        match = await prisma.company.create({ data: { name: r.company } });
        companyByNameLower.set(match.name.toLowerCase(), match);
        companyById.set(match.id, match);
        console.log('  (created new company:', match.name, ')');
      }
      data.companyId = match.id; data.org = null;
      targetCompanyId = match.id;
    }

    if (r.type && CONTACT_TYPE_BY_LABEL[r.type] && CONTACT_TYPE_BY_LABEL[r.type] !== c.type) data.type = CONTACT_TYPE_BY_LABEL[r.type];
    if (r.tier && TIER_BY_LABEL[r.tier] && TIER_BY_LABEL[r.tier] !== c.tier) data.tier = TIER_BY_LABEL[r.tier];
    if (r.status && STAGE_BY_LABEL[r.status] && STAGE_BY_LABEL[r.status] !== c.status) data.status = STAGE_BY_LABEL[r.status];
    if (r.doNotContact !== undefined) {
      const rowDoNotContact = r.doNotContact.toLowerCase() === 'yes';
      if (rowDoNotContact !== c.doNotContact) data.doNotContact = rowDoNotContact;
    }
    if (r.closeProbability !== '' && Number(r.closeProbability) !== (c.closeProbability ?? null)) data.closeProbability = Number(r.closeProbability);
    if (r.recordContexts) {
      // Additive only (union with what's already there) — never removes a
      // role the sheet simply doesn't happen to list, same reasoning as tags
      // below. A real removal should go through the app's own edit UI.
      const parts = r.recordContexts.split(';').map(s => s.trim()).filter(Boolean);
      const enums = parts.map(p => RC_BY_LABEL[p]).filter(Boolean);
      const unionedRC = Array.from(new Set([...(c.recordContexts||[]), ...enums]));
      if (unionedRC.length !== (c.recordContexts||[]).length) data.recordContexts = unionedRC;
    }
    if ((c.email ?? '') !== r.email) {
      data.email = r.email || null;
      // Our own placeholder for "don't have a real email yet" — Agora
      // requires an email to import at all, so this is how we track these
      // people without sending them anything. Mirrors isPlaceholderEmail()
      // in src/lib/contact-schema.ts, which covers the same case for the app's own create/edit routes.
      if (r.email && r.email.toLowerCase().endsWith('@needemail.com')) data.doNotContact = true;
      // A real email replacing the placeholder lifts the flag the placeholder set.
      else if (r.email && (c.email ?? '').toLowerCase().endsWith('@needemail.com')) data.doNotContact = false;
    }
    if ((c.phone ?? '') !== r.phone) data.phone = r.phone || null;
    if ((c.city ?? '') !== r.city) data.city = r.city || null;
    if ((c.state ?? '') !== r.state) data.state = r.state || null;
    const oldLastContact = c.lastContact ? new Date(c.lastContact).toISOString().slice(0,10) : '';
    if (oldLastContact !== r.lastContact) data.lastContact = r.lastContact ? new Date(r.lastContact) : null;
    const oldCadence = c.cadenceOverrideDays != null ? String(c.cadenceOverrideDays) : '';
    if (oldCadence !== r.cadenceOverrideDays) data.cadenceOverrideDays = r.cadenceOverrideDays ? parseInt(r.cadenceOverrideDays, 10) : null;
    if ((c.priorityQuarter ?? '') !== r.priorityQuarter) data.priorityQuarter = r.priorityQuarter || null;
    const currentOwnerDisplay = c.owner?.name || c.owner?.email || '';
    if (r.owner !== currentOwnerDisplay) {
      if (!r.owner) data.ownerId = null;
      else { const u = userByDisplay.get(r.owner.toLowerCase()); if (u) data.ownerId = u.id; }
    }
    if ((c.warmPath ?? '') !== r.warmPath) data.warmPath = r.warmPath || null;
    if ((c.researchBio ?? '') !== r.researchBio) data.researchBio = r.researchBio || null;
    const oldCommitLow = c.commitmentLow != null ? String(c.commitmentLow) : '';
    if (oldCommitLow !== r.commitLow) data.commitmentLow = r.commitLow ? Number(r.commitLow) : null;
    const oldCommitHigh = c.commitmentHigh != null ? String(c.commitmentHigh) : '';
    if (oldCommitHigh !== r.commitHigh) data.commitmentHigh = r.commitHigh ? Number(r.commitHigh) : null;

    const sheetTags = r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const tagColTags = r.tagColTags.map(t => canonicalTag.get(t.trim()) ?? t);
    const allNewTags = Array.from(new Set([...sheetTags, ...r.mlTags, ...tagColTags]));
    const unioned = Array.from(new Set([...(c.tags||[]), ...allNewTags]));
    if (unioned.length !== (c.tags||[]).length) data.tags = unioned;

    if (Object.keys(data).length > 0) {
      await prisma.contact.update({ where: { id: c.id }, data });
      const detail = Object.keys(data)
        .filter(k => k !== 'tags' && k !== 'recordContexts')
        .map(k => `${k}: ${JSON.stringify(c[k] ?? null)} -> ${JSON.stringify(data[k])}`)
        .join('; ');
      diffs.push((data.name ? c.name + ' -> ' + data.name : r.name) + ': ' + Object.keys(data).join(', ') + (detail ? '  [' + detail + ']' : ''));
      updated++;
    }

    // Company-level fields: write through to the linked Company record.
    if (targetCompanyId) {
      const co = companyById.get(targetCompanyId);
      const coData = {};
      if (r.assetClasses) {
        const enums = r.assetClasses.split(';').map(s => s.trim()).filter(Boolean).map(l => ASSET_CLASS_BY_LABEL[l]).filter(Boolean);
        const sortedNew = [...enums].sort().join(','), sortedOld = [...(co.targetAssetClasses||[])].sort().join(',');
        if (sortedNew !== sortedOld) coData.targetAssetClasses = enums;
      }
      if (r.structures) {
        const enums = r.structures.split(';').map(s => s.trim()).filter(Boolean).map(l => STRUCTURE_BY_LABEL[l]).filter(Boolean);
        const sortedNew = [...enums].sort().join(','), sortedOld = [...(co.investmentStructures||[])].sort().join(',');
        if (sortedNew !== sortedOld) coData.investmentStructures = enums;
      }
      if (r.strategies) {
        const enums = r.strategies.split(';').map(s => s.trim()).filter(Boolean).map(l => STRATEGY_BY_LABEL[l]).filter(Boolean);
        const sortedNew = [...enums].sort().join(','), sortedOld = [...(co.investmentStrategies||[])].sort().join(',');
        if (sortedNew !== sortedOld) coData.investmentStrategies = enums;
      }
      const oldSizeMin = co.investmentSizeMin != null ? String(co.investmentSizeMin) : '';
      if (oldSizeMin !== r.sizeMin) coData.investmentSizeMin = r.sizeMin ? Number(r.sizeMin) : null;
      const oldSizeMax = co.investmentSizeMax != null ? String(co.investmentSizeMax) : '';
      if (oldSizeMax !== r.sizeMax) coData.investmentSizeMax = r.sizeMax ? Number(r.sizeMax) : null;
      if ((co.aum ?? '') !== r.companyAum) coData.aum = r.companyAum || null;
      if ((co.website ?? '') !== r.companyWebsite) coData.website = r.companyWebsite || null;

      if (Object.keys(coData).length > 0) {
        const updatedCo = await prisma.company.update({ where: { id: co.id }, data: coData });
        companyById.set(co.id, updatedCo);
        diffs.push('  [company] ' + co.name + ': ' + Object.keys(coData).join(', '));
      }
    }
  }
  console.log('\nUpdated:', updated);
  diffs.forEach(d => console.log(' ', d));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
