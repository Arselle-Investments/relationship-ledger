"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Company, ContactTier, ContactType, Contact, Deal, DealFeedback, DealOutreach, RecordContext, User } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_TAG_CLASS,
  COMPANY_ASSET_CLASS_OPTIONS,
  COMPANY_INVESTMENT_STRUCTURE_OPTIONS,
  COMPANY_INVESTMENT_STRATEGY_OPTIONS,
} from "@/lib/deal-constants";
import { RECORD_CONTEXT_LABELS, RECORD_CONTEXT_TAG_CLASS } from "@/lib/record-context";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";
import { ViewField } from "@/components/contacts/ViewField";
import { TaskModal } from "@/components/tasks/TaskModal";
import { MultiSelectWriteIn } from "@/components/MultiSelectWriteIn";
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
  const [tierFilter, setTierFilter] = useState<ContactTier | "UNTIERED" | "">("");
  const [typeFilter, setTypeFilter] = useState<ContactType | "">("");
  const [contextFilter, setContextFilter] = useState<RecordContext | "">("");
  const [exporting, setExporting] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<CompanyAdvancedFilters>(EMPTY_COMPANY_ADVANCED_FILTERS);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  // Defaults to View each time a different company is opened — most visits
  // are "what does this say," not "let me change something," same reasoning
  // as the Contact modal's own View/Edit toggle.
  const [companyMode, setCompanyMode] = useState<"view" | "edit">("view");
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => {
    setCompanyMode("view");
  }, [selectedCompany]);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  async function patchCompany(
    id: string,
    data: {
      tier?: ContactTier | null;
      priorityQuarter?: string | null;
      website?: string | null;
      linkedinUrl?: string | null;
      aum?: string | null;
      founded?: string | null;
      targetAssetClasses?: string[];
      investmentStructures?: string[];
      investmentStrategies?: string[];
      investmentSizeMin?: number | null;
      investmentSizeMax?: number | null;
    }
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

  // Baseline checklist options for the editable multi-selects, merged with
  // whatever's already on file so a prior write-in shows up as a normal
  // checkbox for every company after that, not just the one it was typed on.
  const assetClassOptions = useMemo(
    () => Array.from(new Set([...COMPANY_ASSET_CLASS_OPTIONS, ...assetClasses])).sort(),
    [assetClasses]
  );
  const investmentStructureOptions = useMemo(
    () => Array.from(new Set([...COMPANY_INVESTMENT_STRUCTURE_OPTIONS, ...investmentStructures])).sort(),
    [investmentStructures]
  );
  const investmentStrategyOptions = useMemo(
    () => Array.from(new Set([...COMPANY_INVESTMENT_STRATEGY_OPTIONS, ...investmentStrategies])).sort(),
    [investmentStrategies]
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
      // A linked company record is the source of truth for where this
      // contact belongs — falling back to the free-text org only when no
      // link exists keeps contacts grouped correctly even after a company
      // rename/merge leaves the contact's own org string stale.
      const org = (c.company?.name ?? c.org)?.trim();
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
      if (tierFilter === "UNTIERED" && g.company?.tier) return false;
      if (tierFilter && tierFilter !== "UNTIERED" && g.company?.tier !== tierFilter) return false;
      if (typeFilter && g.company?.type !== typeFilter) return false;
      if (contextFilter && !g.company?.recordContexts.includes(contextFilter)) return false;
      if (advancedFilters.sources.length > 0 && !advancedFilters.sources.every((s) => (g.company?.sources ?? []).includes(s))) return false;
      if (advancedFilters.agoraStatus === "PENDING" && g.company?.agoraExportedAt) return false;
      if (advancedFilters.agoraStatus === "EXPORTED" && !g.company?.agoraExportedAt) return false;
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
  }, [groups, search, assetClassFilter, tierFilter, typeFilter, contextFilter, advancedFilters]);

  async function exportFiltered() {
    const companyIds = filtered.map((g) => g.company?.id).filter((id): id is string => !!id);
    if (companyIds.length === 0) return;
    setExporting(true);
    const res = await fetch("/api/companies/export-filtered", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyIds }),
    });
    setExporting(false);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arselle-companies-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch("");
    setAssetClassFilter("");
    setTierFilter("");
    setTypeFilter("");
    setContextFilter("");
    setAdvancedFilters(EMPTY_COMPANY_ADVANCED_FILTERS);
  }

  const anyFilterActive =
    !!search || !!assetClassFilter || !!tierFilter || !!typeFilter || !!contextFilter || activeAdvancedCount > 0;

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
        <span className="helptext" style={{ margin: 0 }}>Fund vs. Deal:</span>
        <div className="view-toggle">
          <button className={contextFilter === "" ? "active" : ""} onClick={() => setContextFilter("")}>
            All
          </button>
          <button className={contextFilter === "FUND" ? "active" : ""} onClick={() => setContextFilter("FUND")}>
            Fund
          </button>
          <button className={contextFilter === "DEAL" ? "active" : ""} onClick={() => setContextFilter("DEAL")}>
            Deal
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search company name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as ContactTier | "UNTIERED" | "")}>
          <option value="">All tiers</option>
          {Object.values(ContactTier).map((t) => (
            <option key={t} value={t}>
              {CONTACT_TIER_LABELS[t]}
            </option>
          ))}
          <option value="UNTIERED">No tier</option>
        </select>
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
        {anyFilterActive && (
          <button className="btn ghost" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <div className="spacer" />
        <button className="btn" onClick={exportFiltered} disabled={exporting}>
          {exporting ? "Exporting…" : "Export filtered to Excel"}
        </button>
      </div>

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {groups.length} companies
        {noOrgCount > 0 ? ` · ${noOrgCount} contact${noOrgCount === 1 ? "" : "s"} with no organization on file` : ""}
        {assetClassFilter ? ` · filtered to ${assetClassFilter} investors` : ""}
        {tierFilter === "UNTIERED" ? " · no tier set" : tierFilter ? ` · ${CONTACT_TIER_LABELS[tierFilter]}` : ""}
        {typeFilter ? ` · ${CONTACT_TYPE_LABELS[typeFilter]}` : ""}
        {contextFilter ? ` · ${RECORD_CONTEXT_LABELS[contextFilter]}-side only` : ""}
        {advancedFilters.sources.length > 0 ? ` · sourced from ${advancedFilters.sources.join(" + ")}` : ""}
        {advancedFilters.agoraStatus === "PENDING" ? " · not yet in Agora" : advancedFilters.agoraStatus === "EXPORTED" ? " · already in Agora" : ""}
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
              <th>Fund/Deal</th>
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
                <td>
                  {g.company && g.company.recordContexts.length > 0 ? (
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {g.company.recordContexts.map((ctx) => (
                        <span key={ctx} className={`tag ${RECORD_CONTEXT_TAG_CLASS[ctx]}`}>
                          {RECORD_CONTEXT_LABELS[ctx]}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
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
              {activeCompany && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  {activeCompany.sources.length > 0 ? (
                    <div>
                      {activeCompany.sources.map((s) => (
                        <span key={s} className="tag forest">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div />
                  )}
                  {canEdit && (
                    <div className="view-toggle">
                      <button className={companyMode === "view" ? "active" : ""} onClick={() => setCompanyMode("view")}>
                        View
                      </button>
                      <button className={companyMode === "edit" ? "active" : ""} onClick={() => setCompanyMode("edit")}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeCompany ? (
                companyMode === "view" ? (
                  <>
                    <ViewField label="Tier" value={activeCompany.tier ? CONTACT_TIER_LABELS[activeCompany.tier] : "No tier"} />
                    {activeCompany.priorityQuarter && <ViewField label="Priority quarter" value={activeCompany.priorityQuarter} />}
                    {activeCompany.website && (
                      <ViewField
                        label="Website"
                        value={
                          <a href={activeCompany.website} target="_blank" rel="noopener noreferrer">
                            {activeCompany.website}
                          </a>
                        }
                      />
                    )}
                    {activeCompany.linkedinUrl && (
                      <ViewField
                        label="LinkedIn"
                        value={
                          <a href={activeCompany.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            {activeCompany.linkedinUrl}
                          </a>
                        }
                      />
                    )}
                    {activeCompany.aum && <ViewField label="AUM" value={activeCompany.aum} />}
                    {activeCompany.founded && <ViewField label="Founded" value={activeCompany.founded} />}
                    {(activeCompany.targetAssetClasses.length > 0 ||
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
                    )}
                  </>
                ) : (
                  <>
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
                    <div className="field-row" style={{ marginBottom: 16 }}>
                      <div className="field">
                        <label>Asset classes</label>
                        <MultiSelectWriteIn
                          options={assetClassOptions}
                          selected={activeCompany.targetAssetClasses}
                          disabled={!canEdit}
                          onChange={(next) => patchCompany(activeCompany.id, { targetAssetClasses: next })}
                        />
                      </div>
                      <div className="field">
                        <label>Investment structures</label>
                        <MultiSelectWriteIn
                          options={investmentStructureOptions}
                          selected={activeCompany.investmentStructures}
                          disabled={!canEdit}
                          onChange={(next) => patchCompany(activeCompany.id, { investmentStructures: next })}
                        />
                      </div>
                    </div>
                    <div className="field-row" style={{ marginBottom: 16 }}>
                      <div className="field">
                        <label>Investment strategy</label>
                        <MultiSelectWriteIn
                          options={investmentStrategyOptions}
                          selected={activeCompany.investmentStrategies}
                          disabled={!canEdit}
                          onChange={(next) => patchCompany(activeCompany.id, { investmentStrategies: next })}
                        />
                      </div>
                      <div className="field">
                        <label>Check size range ($mm)</label>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="number"
                            placeholder="Min"
                            defaultValue={activeCompany.investmentSizeMin ?? ""}
                            disabled={!canEdit}
                            onBlur={(e) =>
                              patchCompany(activeCompany.id, {
                                investmentSizeMin: e.target.value.trim() ? Number(e.target.value) : null,
                              })
                            }
                          />
                          <span className="muted">to</span>
                          <input
                            type="number"
                            placeholder="Max"
                            defaultValue={activeCompany.investmentSizeMax ?? ""}
                            disabled={!canEdit}
                            onBlur={(e) =>
                              patchCompany(activeCompany.id, {
                                investmentSizeMax: e.target.value.trim() ? Number(e.target.value) : null,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )
              ) : (
                <div className="helptext" style={{ marginBottom: 16 }}>
                  No company record on file yet for this organization, so tier and priority quarter aren&rsquo;t set-able until one exists.
                </div>
              )}

              <div className="helptext" style={{ marginBottom: 10 }}>
                {activeGroup.contacts.length} contact{activeGroup.contacts.length === 1 ? "" : "s"}
              </div>
              <table style={{ marginBottom: activeCompany && activeCompany.feedback.length > 0 ? 20 : 0 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact Type</th>
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
            {canEdit && (
              <div className="modal-foot">
                <button className="btn small ghost" onClick={() => setAddingTask(true)}>
                  + Add task
                </button>
                <span />
              </div>
            )}
          </div>
        </div>
      )}

      {addingTask && activeGroup && (
        <TaskModal
          task={null}
          team={team}
          contacts={activeGroup.contacts}
          canEdit={canEdit}
          onClose={() => setAddingTask(false)}
          onSaved={() => setAddingTask(false)}
          onDeleted={() => setAddingTask(false)}
        />
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
          sources={allSources}
        />
      )}
    </div>
  );
}
