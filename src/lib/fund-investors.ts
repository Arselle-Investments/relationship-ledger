import { Company, Contact, FundraisingStage } from "@prisma/client";
import { PIPELINE_STAGES } from "@/lib/funnel";

// Applied by a human reviewer to keep a contact out of the fund pipeline even
// when something else would count them in — it always wins.
const EXCLUDED_TAG = "Not a Fund Prospect";

// Firms whose contacts sit in different divisions with separate investment
// decisions, so each Fund contact is counted as their own investor instead of
// being rolled into one firm-level entry. Matched on the company name,
// ignoring case. Reviewed case by case — take a firm off this list once each
// of its contacts has been sorted out.
export const FUND_FUNNEL_SPLIT_COMPANIES = [
  "JLL",
  "CBRE",
  "Citizens Private Wealth",
  "Morgan Stanley",
  "City of Santa Barbara",
];

const SPLIT_NAMES = new Set(FUND_FUNNEL_SPLIT_COMPANIES.map((n) => n.toLowerCase()));

/** A contact counts toward the fund funnel only when they're marked as a Fund prospect. */
export function isFundProspect(contact: Pick<Contact, "recordContexts" | "tags">): boolean {
  return contact.recordContexts.includes("FUND") && !contact.tags.includes(EXCLUDED_TAG);
}

export function isFundFunnelSplitCompany(company: Pick<Company, "name">): boolean {
  return SPLIT_NAMES.has(company.name.trim().toLowerCase());
}

const PIPELINE_RANK = new Map(PIPELINE_STAGES.map((s, i) => [s, i]));

/**
 * The one stage a company shows at in the funnel. If anyone there has declined
 * or been parked as a Fund II prospect, the whole company is — a decline wins
 * over a Fund II pass. Otherwise it's the furthest-along stage of anyone there.
 */
export function rolledUpStage(statuses: FundraisingStage[]): FundraisingStage {
  if (statuses.includes(FundraisingStage.DECLINE)) return FundraisingStage.DECLINE;
  if (statuses.includes(FundraisingStage.PASSED_OPEN)) return FundraisingStage.PASSED_OPEN;
  let best: FundraisingStage = FundraisingStage.NOT_STARTED;
  for (const s of statuses) {
    if ((PIPELINE_RANK.get(s) ?? 0) > (PIPELINE_RANK.get(best) ?? 0)) best = s;
  }
  return best;
}

/**
 * The company-level entries for the fund funnel: every company that's flagged
 * Fund or has at least one Fund contact, counted once, at its rolled-up stage.
 * A split company (see FUND_FUNNEL_SPLIT_COMPANIES) that has Fund contacts is
 * left out — those contacts are counted individually. Each entry carries the
 * company's Fund contacts, taken from the contacts passed in so it reflects
 * edits made on screen.
 */
export function buildFundCompanies<C extends Company, K extends Contact>(
  companies: C[],
  contacts: K[]
): (C & { contacts: K[] })[] {
  const fundByCompany = new Map<string, K[]>();
  for (const c of contacts) {
    if (!c.companyId || !isFundProspect(c)) continue;
    const list = fundByCompany.get(c.companyId) ?? [];
    list.push(c);
    fundByCompany.set(c.companyId, list);
  }

  const entries: (C & { contacts: K[] })[] = [];
  for (const co of companies) {
    const fundContacts = fundByCompany.get(co.id) ?? [];
    const flagged = co.recordContexts.includes("FUND");
    if (!flagged && fundContacts.length === 0) continue;
    if (fundContacts.length > 0 && isFundFunnelSplitCompany(co)) continue;
    const statuses = [...(flagged ? [co.status] : []), ...fundContacts.map((c) => c.status)];
    entries.push({ ...co, status: rolledUpStage(statuses), contacts: fundContacts });
  }
  return entries;
}
