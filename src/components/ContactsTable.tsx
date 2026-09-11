"use client";

import { useMemo, useState } from "react";
import { ContactWithRelations } from "@/types/contact";

/**
 * A searchable table of contacts, used anywhere a card expands to show its
 * members (Mailing Lists, Deliverables) — one shared look so both feel like
 * the same feature, and a click on a name opens the full contact record via
 * whatever ContactModal the caller already has wired up.
 */
export function ContactsTable({
  contacts,
  onOpenContact,
  emptyMessage = "No contacts.",
}: {
  contacts: ContactWithRelations[];
  onOpenContact: (contact: ContactWithRelations) => void;
  emptyMessage?: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.org ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  if (contacts.length === 0) {
    return <div className="muted">{emptyMessage}</div>;
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search within these contacts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10, maxWidth: 280 }}
        onClick={(e) => e.stopPropagation()}
      />
      {filtered.length === 0 ? (
        <div className="muted">No matches.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Owner</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="name-cell" onClick={() => onOpenContact(c)} style={{ cursor: "pointer" }}>
                  {c.name}
                </td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td className="muted">{c.owner?.name || "—"}</td>
                <td className="muted">{c.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
