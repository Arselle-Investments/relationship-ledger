"use client";

import { useMemo, useState } from "react";
import { User } from "@prisma/client";
import { CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";

type Company = {
  name: string;
  contacts: ContactWithRelations[];
};

export function CompaniesClient({
  contacts: initialContacts,
  team,
  canEdit,
}: {
  contacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);

  const companies = useMemo(() => {
    const byOrg = new Map<string, ContactWithRelations[]>();
    for (const c of contacts) {
      const org = c.org?.trim();
      if (!org) continue;
      if (!byOrg.has(org)) byOrg.set(org, []);
      byOrg.get(org)!.push(c);
    }
    const list: Company[] = Array.from(byOrg.entries()).map(([name, contacts]) => ({ name, contacts }));
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [contacts]);

  const noOrgCount = contacts.length - companies.reduce((sum, c) => sum + c.contacts.length, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  const activeCompany = selectedCompany ? companies.find((c) => c.name === selectedCompany) ?? null : null;

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
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="spacer" />
      </div>

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {companies.length} companies
        {noOrgCount > 0 ? ` · ${noOrgCount} contact${noOrgCount === 1 ? "" : "s"} with no organization on file` : ""}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No companies found</h3>
          <div>Try adjusting your search.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contacts</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.name} onClick={() => setSelectedCompany(c.name)}>
                <td className="name-cell">{c.name}</td>
                <td>{c.contacts.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeCompany && (
        <div className="overlay open" onClick={() => setSelectedCompany(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{activeCompany.name}</h2>
              <button className="close-x" onClick={() => setSelectedCompany(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="helptext" style={{ marginBottom: 10 }}>
                {activeCompany.contacts.length} contact{activeCompany.contacts.length === 1 ? "" : "s"}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCompany.contacts.map((c) => (
                    <tr key={c.id} onClick={() => setEditingContact(c)}>
                      <td className="name-cell">{c.name}</td>
                      <td>{c.agoraType || CONTACT_TYPE_LABELS[c.type]}</td>
                      <td>{c.primaryLocation || c.city || <span className="muted">—</span>}</td>
                      <td>{c.owner?.name || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    </div>
  );
}
