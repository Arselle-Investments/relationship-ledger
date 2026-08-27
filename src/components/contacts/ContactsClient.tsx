"use client";

import { useMemo, useState } from "react";
import { User, ContactType, ContactTier } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "./ContactModal";
import { AdvancedFilters, ContactsFilterModal, EMPTY_ADVANCED_FILTERS, countActiveAdvancedFilters } from "./ContactsFilterModal";

export function ContactsClient({
  initialContacts,
  team,
  canEdit,
}: {
  initialContacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [agoraTypeFilter, setAgoraTypeFilter] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [editing, setEditing] = useState<ContactWithRelations | null | "new">(null);
  const [agoraExporting, setAgoraExporting] = useState(false);
  const [agoraMsg, setAgoraMsg] = useState<string | null>(null);
  const [agoraExportDays, setAgoraExportDays] = useState("");

  const pendingAgoraCount = contacts.filter((c) => !c.agoraExportedAt).length;
  const activeAdvancedCount = countActiveAdvancedFilters(advancedFilters);

  const agoraTypes = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.agoraType).filter((v): v is string => !!v))).sort(),
    [contacts]
  );
  const locations = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.primaryLocation).filter((v): v is string => !!v))).sort(),
    [contacts]
  );
  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap((c) => c.tags ?? []))).sort(), [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const commitmentMin = advancedFilters.commitmentMin ? Number(advancedFilters.commitmentMin) : null;
    const commitmentMax = advancedFilters.commitmentMax ? Number(advancedFilters.commitmentMax) : null;
    return contacts.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (tierFilter && c.tier !== tierFilter) return false;
      if (ownerFilter && c.ownerId !== ownerFilter) return false;
      if (agoraTypeFilter && c.agoraType !== agoraTypeFilter) return false;
      if (advancedFilters.status && c.status !== advancedFilters.status) return false;
      if (advancedFilters.warmPathId && c.warmPathId !== advancedFilters.warmPathId) return false;
      if (advancedFilters.primaryLocation && c.primaryLocation !== advancedFilters.primaryLocation) return false;
      if (advancedFilters.tag && !(c.tags ?? []).includes(advancedFilters.tag)) return false;
      if (advancedFilters.emailTier && c.emailTier !== Number(advancedFilters.emailTier)) return false;
      if (advancedFilters.hasEmail && !c.email) return false;
      if (advancedFilters.hasPhone && !c.phone) return false;
      if (commitmentMin !== null && (c.commitmentLow == null || c.commitmentLow < commitmentMin)) return false;
      if (commitmentMax !== null && (c.commitmentHigh == null || c.commitmentHigh > commitmentMax)) return false;
      if (q) {
        const haystack = [c.name, c.org ?? "", c.primaryLocation ?? "", c.agoraType ?? "", ...(c.tags ?? [])]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, typeFilter, tierFilter, ownerFilter, agoraTypeFilter, advancedFilters]);

  function upsertLocal(contact: ContactWithRelations) {
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === contact.id);
      return exists ? prev.map((c) => (c.id === contact.id ? contact : c)) : [...prev, contact];
    });
    setEditing(null);
  }

  function removeLocal(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setEditing(null);
  }

  function updateLocalInPlace(contact: ContactWithRelations) {
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
  }

  function exportUrl() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (tierFilter) params.set("tier", tierFilter);
    if (ownerFilter) params.set("ownerId", ownerFilter);
    return `/api/contacts/export?${params.toString()}`;
  }

  async function handleAgoraExport() {
    setAgoraExporting(true);
    setAgoraMsg(null);
    const url = agoraExportDays
      ? `/api/contacts/export-new-for-agora?days=${agoraExportDays}`
      : "/api/contacts/export-new-for-agora";
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setAgoraExporting(false);
      setAgoraMsg(json.error ?? "Something went wrong.");
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `arselle-new-contacts-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    setAgoraExporting(false);
    setAgoraMsg(`Exported and marked as sent to Agora.`);
    const refreshed = await fetch("/api/contacts").then((r) => r.json());
    setContacts(refreshed.contacts);
  }

  return (
    <div>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search name, org, tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {Object.values(ContactType).map((t) => (
            <option key={t} value={t}>
              {CONTACT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="">All tiers</option>
          {Object.values(ContactTier).map((t) => (
            <option key={t} value={t}>
              {CONTACT_TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">All owners</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
        <select value={agoraTypeFilter} onChange={(e) => setAgoraTypeFilter(e.target.value)}>
          <option value="">All Agora types</option>
          {agoraTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => setShowAllFilters(true)}>
          All filters{activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ""}
        </button>
        <div className="spacer" />
        {canEdit && pendingAgoraCount > 0 && (
          <>
            <select value={agoraExportDays} onChange={(e) => setAgoraExportDays(e.target.value)}>
              <option value="">All pending ({pendingAgoraCount})</option>
              <option value="15">Added in last 15 days</option>
              <option value="30">Added in last 30 days</option>
            </select>
            <button className="btn" onClick={handleAgoraExport} disabled={agoraExporting}>
              {agoraExporting ? "Exporting…" : "Export new for Agora"}
            </button>
          </>
        )}
        <a className="btn" href={exportUrl()}>
          Export to Excel
        </a>
        {canEdit && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            Add contact
          </button>
        )}
      </div>

      {agoraMsg && <div className="helptext" style={{ marginBottom: 12 }}>{agoraMsg}</div>}
      <div className="helptext" style={{ marginBottom: 12 }}>
        Showing {filtered.length} of {contacts.length} contacts.
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No contacts found</h3>
          <div>{contacts.length === 0 ? "Add your first contact to get started." : "Try adjusting your search or filters."}</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Type</th>
              <th>Location</th>
              <th>Owner</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => setEditing(c)}>
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{c.agoraType || CONTACT_TYPE_LABELS[c.type]}</td>
                <td>{c.primaryLocation || c.city || <span className="muted">—</span>}</td>
                <td>{c.owner?.name || <span className="muted">—</span>}</td>
                <td>
                  {(c.tags ?? []).slice(0, 2).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                  {(c.tags ?? []).length > 2 && <span className="muted">+{(c.tags ?? []).length - 2}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAllFilters && (
        <ContactsFilterModal
          filters={advancedFilters}
          onChange={setAdvancedFilters}
          onClose={() => setShowAllFilters(false)}
          locations={locations}
          tags={allTags}
          team={team}
        />
      )}

      {editing !== null && (
        <ContactModal
          contact={editing === "new" ? null : editing}
          team={team}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
          onLiveUpdate={updateLocalInPlace}
        />
      )}
    </div>
  );
}
