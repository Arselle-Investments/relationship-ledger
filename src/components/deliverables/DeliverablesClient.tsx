"use client";

import { useMemo, useState } from "react";
import { ContactWithRelations } from "@/types/contact";
import { DeliverableWithContacts } from "@/types/deliverable";
import { DeliverableModal } from "./DeliverableModal";

export function DeliverablesClient({
  initialDeliverables,
  allContacts,
  canEdit,
}: {
  initialDeliverables: DeliverableWithContacts[];
  allContacts: ContactWithRelations[];
  canEdit: boolean;
}) {
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DeliverableWithContacts | null | "new">(null);
  const [contactSearch, setContactSearch] = useState("");
  const [lookupContact, setLookupContact] = useState<ContactWithRelations | null>(null);

  const contactMatches = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return [];
    return allContacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [allContacts, contactSearch]);

  const deliverablesForLookup = useMemo(() => {
    if (!lookupContact) return [];
    return deliverables.filter((entry) => entry.contacts.some((c) => c.id === lookupContact.id));
  }, [deliverables, lookupContact]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function upsertLocal(entry: DeliverableWithContacts) {
    setDeliverables((prev) => {
      const exists = prev.some((e) => e.deliverable.id === entry.deliverable.id);
      const next = exists
        ? prev.map((e) => (e.deliverable.id === entry.deliverable.id ? entry : e))
        : [...prev, entry];
      return next.sort((a, b) => a.deliverable.name.localeCompare(b.deliverable.name));
    });
    setEditing(null);
  }

  function removeLocal(id: string) {
    setDeliverables((prev) => prev.filter((e) => e.deliverable.id !== id));
    setEditing(null);
  }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
          Check which deliverables a contact has received
        </div>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <input
            type="text"
            placeholder="Search a contact by name…"
            value={lookupContact ? lookupContact.name : contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value);
              setLookupContact(null);
            }}
          />
          {contactMatches.length > 0 && !lookupContact && (
            <div
              className="card"
              style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, marginTop: 4, padding: 4, maxHeight: 220, overflow: "auto" }}
            >
              {contactMatches.map((c) => (
                <div
                  key={c.id}
                  className="lookup-row"
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
                  onClick={() => {
                    setLookupContact(c);
                    setContactSearch("");
                  }}
                >
                  {c.name} {c.org ? <span className="muted">({c.org})</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {lookupContact && (
          <div style={{ marginTop: 12 }}>
            {deliverablesForLookup.length === 0 ? (
              <div className="helptext" style={{ margin: 0 }}>
                No deliverable currently matches a tag on {lookupContact.name}&rsquo;s record.
              </div>
            ) : (
              <div className="helptext" style={{ margin: 0 }}>
                {lookupContact.name} has received {deliverablesForLookup.length}:{" "}
                {deliverablesForLookup.map((entry, i) => (
                  <span key={entry.deliverable.id}>
                    <strong>{entry.deliverable.name}</strong>
                    {i < deliverablesForLookup.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            )}
            <button
              className="btn small ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                setLookupContact(null);
                setContactSearch("");
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Who&rsquo;s received a letter, deck, or similar send — driven by Agora&rsquo;s own contact tags
        </div>
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            Track a deliverable
          </button>
        )}
      </div>

      {deliverables.length === 0 ? (
        <div className="empty">
          <h3>No deliverables tracked yet</h3>
          <div>Add one and point it at the Agora tag(s) that mark who received it.</div>
        </div>
      ) : (
        deliverables.map((entry) => {
          const isOpen = expanded.has(entry.deliverable.id);
          return (
            <div key={entry.deliverable.id} className="card" style={{ padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ cursor: "pointer" }} onClick={() => toggleExpand(entry.deliverable.id)}>
                  <h3 style={{ fontSize: 16 }}>{entry.deliverable.name}</h3>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                    Matches tag{entry.deliverable.tagMatches.length === 1 ? "" : "s"}: {entry.deliverable.tagMatches.join(" · ")}
                  </div>
                  {entry.deliverable.notes && (
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                      {entry.deliverable.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flex: "none" }}>
                  <span className="tag brass">
                    {entry.contacts.length} contact{entry.contacts.length === 1 ? "" : "s"}
                  </span>
                  <a className="btn small" href={`/api/deliverables/${entry.deliverable.id}/export`}>
                    Export
                  </a>
                  <button className="btn small" onClick={() => toggleExpand(entry.deliverable.id)}>
                    {isOpen ? "Hide" : "View"}
                  </button>
                  {canEdit && (
                    <button className="btn small" onClick={() => setEditing(entry)}>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  {entry.contacts.length === 0 ? (
                    <div className="muted">No contacts currently carry a matching tag.</div>
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
                        {entry.contacts.map((c) => (
                          <tr key={c.id}>
                            <td className="name-cell">{c.name}</td>
                            <td>{c.org || <span className="muted">—</span>}</td>
                            <td className="muted">{c.owner?.name || "—"}</td>
                            <td className="muted">{c.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {editing !== null && (
        <DeliverableModal
          entry={editing === "new" ? null : editing}
          allContacts={allContacts}
          onClose={() => setEditing(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
        />
      )}
    </div>
  );
}
