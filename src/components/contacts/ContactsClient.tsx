"use client";

import { useMemo, useRef, useState } from "react";
import { User, ContactType, ContactTier } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS, CONTACT_STATUS_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "./ContactModal";

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
  const [editing, setEditing] = useState<ContactWithRelations | null | "new">(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (tierFilter && c.tier !== tierFilter) return false;
      if (ownerFilter && c.ownerId !== ownerFilter) return false;
      if (q) {
        const haystack = [c.name, c.org ?? "", ...(c.tags ?? [])].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, typeFilter, tierFilter, ownerFilter]);

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

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/contacts/import", { method: "POST", body: form });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportMsg(json.error ?? "Import failed.");
      return;
    }
    setImportMsg(`Imported: ${json.added} added, ${json.updated} updated, ${json.skipped} skipped.`);
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
        <div className="spacer" />
        <a className="btn" href={exportUrl()}>
          Export to Excel
        </a>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = "";
              }}
            />
            <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? "Importing…" : "Import"}
            </button>
            <button className="btn primary" onClick={() => setEditing("new")}>
              Add contact
            </button>
          </>
        )}
      </div>

      {importMsg && <div className="helptext" style={{ marginBottom: 12 }}>{importMsg}</div>}

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
              <th>Tier</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Last contact</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => setEditing(c)}>
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{CONTACT_TYPE_LABELS[c.type]}</td>
                <td>{CONTACT_TIER_LABELS[c.tier]}</td>
                <td>{CONTACT_STATUS_LABELS[c.status]}</td>
                <td>{c.owner?.name || <span className="muted">—</span>}</td>
                <td>{c.lastContact ? new Date(c.lastContact).toISOString().slice(0, 10) : <span className="muted">—</span>}</td>
                <td>
                  {(c.tags ?? []).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
