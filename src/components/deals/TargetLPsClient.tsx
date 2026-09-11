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
} from "@/components/companies/CompaniesFilterModal";
import { SortHeader, useSort } from "@/components/SortHeader";

type SortField = "name" | "city" | "contacts" | "outreach" | "feedback";

type FeedbackWithRelations = DealFeedback & { deal: Deal; contact: Contact | null };
type OutreachWithDeal = DealOutreach & { deal: Deal };
type CompanyWithFeedback = Company & { feedback: FeedbackWithRelations[]; outreach: OutreachWithDeal[] };

type CompanyGroup = {
  name: string;
  contacts: ContactWithRelations[];
  company: CompanyWithFeedback;
};

// Deal-level LPs we're targeting relationships with — every Company record
// tagged recordContext DEAL, whether or not a deal has been sent yet. This is
// deliberately narrower than Deal Recipients (companies that already received
// at least one deal): a target here may never have gotten anything from us.
export function TargetLPsClient({
  contacts: initialContacts,
  team,
  companies,
  canEdit,
}: {
  contacts: ContactWithRelations[];
  team: User[];
  companies: CompanyWithFeedback[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [assetClassFilter, setAssetClassFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<ContactTier | "UNTIERED" | "">("");
  const [typeFilter, setTypeFilter] = useState<ContactType | "">("");
  const [exporting, setExporting] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<CompanyAdvancedFilters>(EMPTY_COMPANY_ADVANCED_FILTERS);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const { sortKey, toggleSort } = useSort<SortField>("name");

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
  const allSources = useMemo(() => Array.from(new Set(companies.flatMap((c) => c.sources))).sort(), [companies]);
  const activeAdvancedCount = countActiveCompanyFilters(advancedFilters);

  const groups = useMemo<CompanyGroup[]>(() => {
    const contactsByOrgKey = new Map<string, ContactWithRelations[]>();
    for (const c of contacts) {
      const org = c.org?.trim();
      if (!org) continue;
      const key = org.toLowerCase();
      if (!contactsByOrgKey.has(key)) contactsByOrgKey.set(key, []);
      contactsByOrgKey.get(key)!.push(c);
    }
    return companies
      .map((company) => ({
        name: company.name,
        contacts: contactsByOrgKey.get(company.name.toLowerCase()) ?? [],
        company,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sizeMin = advancedFilters.sizeMin ? Number(advancedFilters.sizeMin) : null;
    const sizeMax = advancedFilters.sizeMax ? Number(advancedFilters.sizeMax) : null;
    return groups.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q) && !(g.company.city ?? "").toLowerCase().includes(q)) return false;
      if (assetClassFilter && !g.company.targetAssetClasses.includes(assetClassFilter)) return false;
      if (tierFilter === "UNTIERED" && g.company.tier) return false;
      if (tierFilter && tierFilter !== "UNTIERED" && g.company.tier !== tierFilter) return false;
      if (typeFilter && g.company.type !== typeFilter) return false;
      if (advancedFilters.sources.length > 0 && !advancedFilters.sources.every((s) => g.company.sources.includes(s))) return false;
      if (advancedFilters.agoraStatus === "PENDING" && g.company.agoraExportedAt) return false;
      if (advancedFilters.agoraStatus === "EXPORTED" && !g.company.agoraExportedAt) return false;
      if (advancedFilters.investmentStructure && !g.company.investmentStructures.includes(advancedFilters.investmentStructure)) return false;
      if (advancedFilters.investmentStrategy && !g.company.investmentStrategies.includes(advancedFilters.investmentStrategy)) return false;
      if (advancedFilters.tag && !g.company.tags.includes(advancedFilters.tag)) return false;
      if (advancedFilters.priorityQuarter && g.company.priorityQuarter !== advancedFilters.priorityQuarter) return false;
      if (sizeMin !== null && (g.company.investmentSizeMax == null || g.company.investmentSizeMax < sizeMin)) return false;
      if (sizeMax !== null && (g.company.investmentSizeMin == null || g.company.investmentSizeMin > sizeMax)) return false;
      if (advancedFilters.hasWebsite && !g.company.website) return false;
      if (advancedFilters.hasAum && !g.company.aum) return false;
      if (advancedFilters.hasDealActivity && !(g.company.outreach.length > 0 || g.company.feedback.length > 0)) return false;
      return true;
    });
  }, [groups, search, assetClassFilter, tierFilter, typeFilter, advancedFilters]);

  const sorted = useMemo(() => {
    const dir = sortKey.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey.field) {
        case "city":
          return dir * (a.company.city ?? "").localeCompare(b.company.city ?? "");
        case "contacts":
          return dir * (a.contacts.length - b.contacts.length);
        case "outreach":
          return dir * (a.company.outreach.length - b.company.outreach.length);
        case "feedback":
          return dir * (a.company.feedback.length - b.company.feedback.length);
        default:
          return dir * a.name.localeCompare(b.name);
      }
    });
  }, [filtered, sortKey]);

  async function exportFiltered() {
    const companyIds = filtered.map((g) => g.company.id);
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
    a.download = `arselle-target-lps-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const activeGroup = selectedCompany ? groups.find((g) => g.name === selectedCompany) ?? null : null;
  const activeCompany = activeGroup?.company ?? null;

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
      <div className="helptext" style={{ marginBottom: 12 }}>
        Deal-level LPs we&rsquo;re building or targeting a relationship with, whether or not a deal has been sent yet. Once
        one receives its first deal it also shows up under Deal Recipients.
      </div>

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
        <button className="btn" onClick={exportFiltered} disabled={exporting}>
          {exporting ? "Exporting…" : "Export filtered to Excel"}
        </button>
      </div>

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {groups.length} target LPs
        {assetClassFilter ? ` · filtered to ${assetClassFilter} investors` : ""}
        {tierFilter === "UNTIERED" ? " · no tier set" : tierFilter ? ` · ${CONTACT_TIER_LABELS[tierFilter]}` : ""}
        {typeFilter ? ` · ${CONTACT_TYPE_LABELS[typeFilter]}` : ""}
        {advancedFilters.sources.length > 0 ? ` · sourced from ${advancedFilters.sources.join(" + ")}` : ""}
        {advancedFilters.agoraStatus === "PENDING" ? " · not yet in Agora" : advancedFilters.agoraStatus === "EXPORTED" ? " · already in Agora" : ""}
        {activeAdvancedCount > 0 ? ` · ${activeAdvancedCount} more filter${activeAdvancedCount === 1 ? "" : "s"}` : ""}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No target LPs found</h3>
          <div>Try adjusting your search or filter.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <SortHeader field="name" label="Company" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="city" label="City" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="contacts" label="Contacts" sortKey={sortKey} onSort={toggleSort} />
              <th>Target asset classes</th>
              <SortHeader field="outreach" label="Deals sent" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="feedback" label="Deal feedback" sortKey={sortKey} onSort={toggleSort} />
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g) => (
              <tr key={g.name} onClick={() => setSelectedCompany(g.name)}>
                <td className="name-cell">{g.name}</td>
                <td className="muted">{g.company.city || "—"}</td>
                <td>{g.contacts.length}</td>
                <td className="muted">{g.company.targetAssetClasses.join(", ") || "—"}</td>
                <td className="muted">{g.company.outreach.length}</td>
                <td className="muted">{g.company.feedback.length || 0}</td>
                <td>
                  {g.company.sources.length > 0 ? (
                    g.company.sources.map((s) => (
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

      {activeGroup && activeCompany && (
        <div className="overlay open" onClick={() => setSelectedCompany(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{activeGroup.name}</h2>
              <button className="close-x" onClick={() => setSelectedCompany(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
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
                  <select value={activeCompany.tier ?? ""} disabled>
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
                  <input defaultValue={activeCompany.priorityQuarter ?? ""} disabled />
                </div>
              </div>

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

              <div className="helptext" style={{ marginBottom: 10 }}>
                {activeGroup.contacts.length} contact{activeGroup.contacts.length === 1 ? "" : "s"}
              </div>
              <table style={{ marginBottom: activeCompany.feedback.length > 0 ? 20 : 0 }}>
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

              {activeCompany.outreach.length > 0 && (
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

              {activeCompany.feedback.length > 0 && (
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
          sources={allSources}
        />
      )}
    </div>
  );
}
