"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Company, ContactTier, ContactType, Contact, Deal, DealFeedback, DealOutreach, User } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUS_TAG_CLASS } from "@/lib/deal-constants";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";
import {
  CompaniesFilterModal,
  CompanyAdvancedFilters,
  EMPTY_COMPANY_ADVANCED_FILTERS,
  countActiveCompanyFilters,
} from "./CompaniesFilterModal";

type FeedbackWithRelations = DealFeedback & { deal: Deal; contact: Contact | null };
type OutreachWithDeal = DealOutreach & { deal: Deal };
type CompanyWithFeedback = Company & { feedback: FeedbackWithRelations[]; outreach: OutreachWithDeal[] };

type CompanyGroup = {
  name: string;
  contacts: ContactWithRelations[];
  company: CompanyWithFeedback | null;
};

export function CompaniesClient({
  contacts: initialContacts,
  team,
  companies: initialCompanies,
  canEdit,
}: {
  contacts: ContactWithRelations[];
  team: User[];
  companies: CompanyWithFeedback[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [companies, setCompanies] = useState(initialCompanies);
  const [search, setSearch] = useState("");
  const [assetClassFilter, setAssetClassFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<ContactTier | "UNTIERED" | "">("");
  const [typeFilter, setTypeFilter] = useState<ContactType | "">("");
  const [advancedFilters, setAdvancedFilters] = useState<CompanyAdvancedFilters>(EMPTY_COMPANY_ADVANCED_FILTERS);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  async function patchCompany(
    id: string,
    data: { tier?: ContactTier | null; priorityQuarter?: string | null; website?: string | null; linkedinUrl?: string | null; aum?: string | null; founded?: string | null }
  ) {
    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const json = await res.json();
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.company } : c)));
  }

  const assetClasses = useMemo(
    () => Array.from(new Set(companies.flatMap((c) => c.targetAssetClasses))).sort(),
    [companies]
  );

  const investmentStructures = useMemo(
    () => Array.from(new Set(companies.flatMap((c) => c.investmentStructures))).sort(),
    [companies]
  );
  const investmentStrategies = useMemo(
    () => Array.from(new Set(companies.flatMap((c) => c.investmentStrategies))).sort(),
    [companies]
  );
  const allTags = useMemo(() => Array.from(new Set(companies.flatMap((c) => c.tags))).sort(), [companies]);
  const priorityQuarters = useMemo(
    () => Array.from(new Set(companies.map((c) => c.priorityQuarter).filter((v): v is string => !!v))).sort(),
    [companies]
  );
  const activeAdvancedCount = countActiveCompanyFilters(advancedFilters);

  // Every source that's contributed to at least one company on file —
  // drives the filter row below. A company can carry more than one of these
  // at once (that's the point: one record, full provenance) so this is the
  // audit trail the "collapse but don't lose track of origin" ask needs.
  const allSources = useMemo(() => Array.from(new Set(companies.flatMap((c) => c.sources))).sort(), [companies]);

  // Companies are the primary list now (every Company row gets a slot, not
  // just ones that happen to match a contact's org string), with contacts
  // attached by matching org name. An org only ever seen as free text on a
  // Contact (no Company record yet) still shows up too, so nothing that was
  // visible before goes missing.
  const groups = useMemo(() => {
    const contactsByOrgKey = new Map<string, ContactWithRelations[]>();
    for (const c of contacts) {
      const org = c.org?.trim();
      if (!org) continue;
      const key = org.toLowerCase();
      if (!contactsByOrgKey.has(key)) contactsByOrgKey.set(key, []);
      contactsByOrgKey.get(key)!.push(c);
    }
    const seenKeys = new Set<string>();
    const fromCompanies: CompanyGroup[] = companies.map((company) => {
      const key = company.name.toLowerCase();
      seenKeys.add(key);
      return { name: company.name, contacts: contactsByOrgKey.get(key) ?? [], company };
    });
    const orphanOrgs: CompanyGroup[] = Array.from(contactsByOrgKey.entries())
      .filter(([key]) => !seenKeys.has(key))
      .map(([, groupContacts]) => ({ name: groupContacts[0].org!.trim(), contacts: groupContacts, company: null }));
    return [...fromCompanies, ...orphanOrgs].sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, companies]);

  const noOrgCount = contacts.length - groups.reduce((sum, c) => sum + c.contacts.length, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sizeMin = advancedFilters.sizeMin ? Number(advancedFilters.sizeMin) : null;
    const sizeMax = advancedFilters.sizeMax ? Number(advancedFilters.sizeMax) : null;
    return groups.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !(g.company?.city ?? "").toLowerCase().includes(q)) return false;
      if (assetClassFilter && !(g.company?.targetAssetClasses ?? []).includes(assetClassFilter)) return false;
      if (sourceFilter && !(g.company?.sources ?? []).includes(sourceFilter)) return false;
      if (tierFilter === "UNTIERED" && g.company?.tier) return false;
      if (tierFilter && tierFilter !== "UNTIERED" && g.company?.tier !== tierFilter) return false;
      if (typeFilter && g.company?.type !== typeFilter) return false;
      if (advancedFilters.investmentStructure && !(g.company?.investmentStructures ?? []).includes(advancedFilters.investmentStructure)) return false;
      if (advancedFilters.investmentStrategy && !(g.company?.investmentStrategies ?? []).includes(advancedFilters.investmentStrategy)) return false;
      if (advancedFilters.tag && !(g.company?.tags ?? []).includes(advancedFilters.tag)) return false;
      if (advancedFilters.priorityQuarter && g.company?.priorityQuarter !== advancedFilters.priorityQuarter) return false;
      if (sizeMin !== null && (g.company?.investmentSizeMax == null || g.company.investmentSizeMax < sizeMin)) return false;
      if (sizeMax !== null && (g.company?.investmentSizeMin == null || g.company.investmentSizeMin > sizeMax)) return false;
      if (advancedFilters.hasWebsite && !g.company?.website) return false;
      if (advancedFilters.hasAum && !g.company?.aum) return false;
      if (advancedFilters.hasDealActivity && !((g.company?.outreach.length ?? 0) > 0 || (g.company?.feedback.length ?? 0) > 0)) return false;
      return true;
    });
  }, [groups, search, assetClassFilter, sourceFilter, tierFilter, typeFilter, advancedFilters]);

  const activeGroup = selectedCompany ? groups.find((g) => g.name === selectedCompany) ?? null : null;
  const activeCompany = activeGroup?.company
    ? companyById.get(activeGroup.company.id) ?? activeGroup.company
    : null;

  function handleContactSaved(contact: ContactWithRelations) {
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === contact.id);
      return exists ? prev.map((c) => (c.id === contact.id ? contact : c)) : [...prev, contact];
    });
    setEditingContact(null);
  }

  function handleContactDeleted(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setEditingContact(null);
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <span className="helptext" style={{ margin: 0 }}>Tier:</span>
        <div className="view-toggle">
          <button className={tierFilter === "" ? "active" : ""} onClick={() => setTierFilter("")}>
            All
          </button>
          {Object.values(ContactTier).map((t) => (
            <button key={t} className={tierFilter === t ? "active" : ""} onClick={() => setTierFilter(t)}>
              {CONTACT_TIER_LABELS[t]}
            </button>
          ))}
          <button className={tierFilter === "UNTIERED" ? "active" : ""} onClick={() => setTierFilter("UNTIERED")}>
            No tier
          </button>
        </div>
      </div>

      {allSources.length > 0 && (
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="helptext" style={{ margin: 0 }}>Source:</span>
          <div className="view-toggle">
            <button className={sourceFilter === "" ? "active" : ""} onClick={() => setSourceFilter("")}>
              All
            </button>
            {allSources.map((s) => (
              <button key={s} className={sourceFilter === s ? "active" : ""} onClick={() => setSourceFilter(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search company name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ContactType | "")}>
          <option value="">All types</option>
          {Object.values(ContactType).map((t) => (
            <option key={t} value={t}>
              {CONTACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {assetClasses.length > 0 && (
          <select value={assetClassFilter} onChange={(e) => setAssetClassFilter(e.target.value)}>
            <option value="">All asset classes</option>
            {assetClasses.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
        <button className="btn" onClick={() => setShowAllFilters(true)}>
          All filters{activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ""}
        </button>
        <div className="spacer" />
      </div>

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {groups.length} companies
        {noOrgCount > 0 ? ` · ${noOrgCount} contact${noOrgCount === 1 ? "" : "s"} with no organization on file` : ""}
        {assetClassFilter ? ` · filtered to ${assetClassFilter} investors` : ""}
        {sourceFilter ? ` · sourced from ${sourceFilter}` : ""}
        {tierFilter === "UNTIERED" ? " · no tier set" : tierFilter ? ` · ${CONTACT_TIER_LABELS[tierFilter]}` : ""}
        {typeFilter ? ` · ${CONTACT_TYPE_LABELS[typeFilter]}` : ""}
        {activeAdvancedCount > 0 ? ` · ${activeAdvancedCount} more filter${activeAdvancedCount === 1 ? "" : "s"}` : ""}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No companies found</h3>
          <div>Try adjusting your search or filter.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contacts</th>
              <th>Target asset classes</th>
              <th>Deal feedback</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.name} onClick={() => setSelectedCompany(g.name)}>
                <td className="name-cell">{g.name}</td>
                <td>{g.contacts.length}</td>
                <td className="muted">{(g.company?.targetAssetClasses ?? []).join(", ") || "—"}</td>
                <td className="muted">{g.company?.feedback.length || 0}</td>
                <td>
                  {(g.company?.sources ?? []).length > 0 ? (
                    g.company!.sources.map((s) => (
                      <span key={s} className="tag" style={{ fontSize: 10 }}>
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeGroup && (
        <div className="overlay open" onClick={() => setSelectedCompany(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{activeGroup.name}</h2>
              <button className="close-x" onClick={() => setSelectedCompany(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {activeCompany ? (
                <>
                  {activeCompany.sources.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      {activeCompany.sources.map((s) => (
                        <span key={s} className="tag forest">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="field-row" style={{ marginBottom: 16 }}>
                    <div className="field">
                      <label>Tier</label>
                      <select
                        value={activeCompany.tier ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => patchCompany(activeCompany.id, { tier: (e.target.value as ContactTier) || null })}
                      >
                        <option value="">No tier</option>
                        {Object.values(ContactTier).map((t) => (
                          <option key={t} value={t}>
                            {CONTACT_TIER_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Priority quarter</label>
                      <input
                        placeholder="e.g. 2026-Q4"
                        defaultValue={activeCompany.priorityQuarter ?? ""}
                        disabled={!canEdit}
                        onBlur={(e) => patchCompany(activeCompany.id, { priorityQuarter: e.target.value.trim() || null })}
                      />
                    </div>
                  </div>
                  <div className="field-row" style={{ marginBottom: 16 }}>
                    <div className="field">
                      <label>Website</label>
                      <input
                        placeholder="https://…"
                        defaultValue={activeCompany.website ?? ""}
                        disabled={!canEdit}
                        onBlur={(e) => patchCompany(activeCompany.id, { website: e.target.value.trim() || null })}
                      />
                    </div>
                    <div className="field">
                      <label>LinkedIn</label>
                      <input
                        placeholder="https://linkedin.com/company/…"
                        defaultValue={activeCompany.linkedinUrl ?? ""}
                        disabled={!canEdit}
                        onBlur={(e) => patchCompany(activeCompany.id, { linkedinUrl: e.target.value.trim() || null })}
                      />
                    </div>
                  </div>
                  <div className="field-row" style={{ marginBottom: 16 }}>
                    <div className="field">
                      <label>AUM</label>
                      <input
                        placeholder="e.g. ~$10B+"
                        defaultValue={activeCompany.aum ?? ""}
                        disabled={!canEdit}
                        onBlur={(e) => patchCompany(activeCompany.id, { aum: e.target.value.trim() || null })}
                      />
                    </div>
                    <div className="field">
                      <label>Founded</label>
                      <input
                        placeholder="e.g. 2011"
                        defaultValue={activeCompany.founded ?? ""}
                        disabled={!canEdit}
                        onBlur={(e) => patchCompany(activeCompany.id, { founded: e.target.value.trim() || null })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="helptext" style={{ marginBottom: 16 }}>
                  No company record on file yet for this organization, so tier and priority quarter aren&rsquo;t set-able until one exists.
                </div>
              )}
              {activeCompany && (
                (activeCompany.targetAssetClasses.length > 0 ||
                  activeCompany.investmentStructures.length > 0 ||
                  activeCompany.investmentStrategies.length > 0 ||
                  activeCompany.investmentSizeMin ||
                  activeCompany.investmentSizeMax) && (
                  <div className="card" style={{ padding: 14, marginBottom: 16, background: "var(--forest-bg)" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: "var(--brass-dark)", marginBottom: 6 }}>
                      Investment criteria
                    </div>
                    {activeCompany.targetAssetClasses.length > 0 && (
                      <div style={{ fontSize: 13, marginBottom: 3 }}>
                        <b>Asset classes:</b> {activeCompany.targetAssetClasses.join(", ")}
                      </div>
                    )}
                    {activeCompany.investmentStructures.length > 0 && (
                      <div style={{ fontSize: 13, marginBottom: 3 }}>
                        <b>Structures:</b> {activeCompany.investmentStructures.join(", ")}
                      </div>
                    )}
                    {activeCompany.investmentStrategies.length > 0 && (
                      <div style={{ fontSize: 13, marginBottom: 3 }}>
                        <b>Strategy:</b> {activeCompany.investmentStrategies.join(", ")}
                      </div>
                    )}
                    {(activeCompany.investmentSizeMin || activeCompany.investmentSizeMax) && (
                      <div style={{ fontSize: 13 }}>
                        <b>Check size:</b> {activeCompany.investmentSizeMin ?? "?"}mm &ndash; {activeCompany.investmentSizeMax ?? "?"}mm
                      </div>
                    )}
                  </div>
                )
              )}

              <div className="helptext" style={{ marginBottom: 10 }}>
                {activeGroup.contacts.length} contact{activeGroup.contacts.length === 1 ? "" : "s"}
              </div>
              <table style={{ marginBottom: activeCompany && activeCompany.feedback.length > 0 ? 20 : 0 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGroup.contacts.map((c) => (
                    <tr key={c.id} onClick={() => setEditingContact(c)}>
                      <td className="name-cell">{c.name}</td>
                      <td>{c.agoraType || CONTACT_TYPE_LABELS[c.type]}</td>
                      <td>{c.primaryLocation || c.city || <span className="muted">—</span>}</td>
                      <td>{c.owner?.name || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {activeCompany && activeCompany.outreach.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 6 }}>
                    Deals sent ({activeCompany.outreach.length})
                  </div>
                  {activeCompany.outreach.map((o) => (
                    <Link key={o.id} href={`/deals/${o.dealId}`} className="tag brass" style={{ textDecoration: "none" }}>
                      {o.deal.name}
                    </Link>
                  ))}
                </div>
              )}

              {activeCompany && activeCompany.feedback.length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
                    Deal feedback ({activeCompany.feedback.length})
                  </div>
                  {activeCompany.feedback.map((f) => (
                    <div key={f.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <Link href={`/deals/${f.dealId}`} style={{ fontWeight: 600, fontSize: 13 }}>
                          {f.deal.name}
                        </Link>
                        <span className={`tag ${FEEDBACK_STATUS_TAG_CLASS[f.status]}`}>{FEEDBACK_STATUS_LABELS[f.status]}</span>
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{f.notes}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {new Date(f.createdAt).toLocaleDateString()}
                        {f.contact ? ` · ${f.contact.name}` : ""}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editingContact && (
        <ContactModal
          contact={editingContact}
          team={team}
          canEdit={canEdit}
          onClose={() => setEditingContact(null)}
          onSaved={handleContactSaved}
          onDeleted={handleContactDeleted}
        />
      )}

      {showAllFilters && (
        <CompaniesFilterModal
          filters={advancedFilters}
          onChange={setAdvancedFilters}
          onClose={() => setShowAllFilters(false)}
          investmentStructures={investmentStructures}
          investmentStrategies={investmentStrategies}
          tags={allTags}
          priorityQuarters={priorityQuarters}
        />
      )}
    </div>
  );
}
