import { Company, Contact, ContactType, FundraisingStage } from "@prisma/client";
import { PIPELINE_STAGES } from "@/lib/funnel";

// Applied by a human reviewer to keep a contact out of the fund pipeline even
// when something else would count them in — it always wins.
const EXCLUDED_TAG = "Not a Fund Prospect";

/** A contact counts toward the fund funnel only when they're marked as a Fund prospect. */
export function isFundProspect(contact: Pick<Contact, "recordContexts" | "tags">): boolean {
  return contact.recordContexts.includes("FUND") && !contact.tags.includes(EXCLUDED_TAG);
}

const PIPELINE_RANK = new Map(PIPELINE_STAGES.map((s, i) => [s, i]));

/**
 * The one stage an investor shows at in the funnel. If anyone in it has
 * declined or been parked as a Fund II prospect, the whole investor is — a
 * decline wins over a Fund II pass. Otherwise it's the furthest-along stage of
 * anyone in it.
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

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** What an investor is matched on: its name, ignoring case and extra spaces. */
export const investorKey = norm;

/** The key of a person counted on their own: their entity name if they have one, else their name. */
export function individualKey(c: Pick<Contact, "name" | "investingEntity">): string {
  return norm(c.investingEntity?.trim() || c.name);
}

export type FundInvestor<K extends Contact = Contact> = {
  /** The company's id, or `entity:<name>` for an investing entity with no company record. */
  id: string;
  /** See investorKey — links the investor to its estimated commitment. */
  key: string;
  name: string;
  status: FundraisingStage;
  /** The company's type, or Advisor when the people in a company-less entity are advisors. */
  type: ContactType;
  kind: "company" | "entity";
  /** The Fund prospects counted in this investor. */
  contacts: K[];
};

type Group<C extends Company, K extends Contact> = { key: string; name: string; company: C | null; contacts: K[] };

/**
 * The investors the AREF I funnel counts, each once, at its rolled-up stage.
 *
 * A Fund contact belongs to the entity named in their Investing Entity; with
 * none, to their Company. Everyone sharing a name is one investor — so a couple
 * investing jointly, or four people at one pension plan, count once. A
 * contact with no company whose entity is just their own name (or blank), and
 * nobody else in it, is an individual: they're left out here and counted on
 * their own by the caller.
 *
 * A Fund-flagged company with no Fund contacts is an investor on its own. A
 * company whose Fund contacts have all been given other entities is not — its
 * people are already counted under those entities.
 */
export function buildFundInvestors<C extends Company, K extends Contact>(
  companies: C[],
  contacts: K[]
): FundInvestor<K>[] {
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const companyByName = new Map(companies.map((c) => [norm(c.name), c]));
  const groups = new Map<string, Group<C, K>>();
  const hasFundContact = new Set<string>();

  for (const c of contacts) {
    if (!isFundProspect(c)) continue;
    if (c.companyId) hasFundContact.add(c.companyId);
    const entity = c.investingEntity?.trim();
    const company = c.companyId ? companyById.get(c.companyId) : undefined;
    let key: string;
    let name: string;
    if (entity) {
      key = norm(entity);
      name = entity;
    } else if (company) {
      key = norm(company.name);
      name = company.name;
    } else {
      continue; // no company, no entity: an individual
    }
    const group = groups.get(key) ?? { key, name, company: companyByName.get(key) ?? null, contacts: [] };
    group.contacts.push(c);
    groups.set(key, group);
  }

  for (const co of companies) {
    if (!co.recordContexts.includes("FUND")) continue;
    const key = norm(co.name);
    const group = groups.get(key);
    if (group) group.company = co;
    else if (!hasFundContact.has(co.id)) groups.set(key, { key, name: co.name, company: co, contacts: [] });
  }

  const investors: FundInvestor<K>[] = [];
  for (const g of groups.values()) {
    // Someone whose entity is just their own name, with nobody else in it, is
    // an individual — counted on their own by the caller, not as an investor card.
    if (!g.company && g.contacts.length === 1 && norm(g.contacts[0].name) === g.key) continue;
    const flagged = !!g.company?.recordContexts.includes("FUND");
    const statuses = [...(flagged && g.company ? [g.company.status] : []), ...g.contacts.map((c) => c.status)];
    const isAdvisor = g.contacts.some((c) => c.agoraType === "Advisor" || c.type === ContactType.ADVISOR);
    investors.push({
      id: g.company ? g.company.id : `entity:${g.key}`,
      key: g.key,
      name: g.company ? g.company.name : g.name,
      status: rolledUpStage(statuses),
      type: g.company ? g.company.type : isAdvisor ? ContactType.ADVISOR : ContactType.OTHER,
      kind: g.company ? "company" : "entity",
      contacts: g.contacts,
    });
  }
  return investors;
}
