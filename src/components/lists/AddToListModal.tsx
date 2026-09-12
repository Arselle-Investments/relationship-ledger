"use client";

import { useMemo, useState } from "react";
import { ContactWithRelations } from "@/types/contact";
import { MailingListWithContacts } from "@/types/mailing-list";

export function AddToListModal({
  lists,
  allContacts,
  onClose,
  onUpdated,
  onContactUpdated,
}: {
  lists: MailingListWithContacts[];
  allContacts: ContactWithRelations[];
  onClose: () => void;
  onUpdated: (entry: MailingListWithContacts) => void;
  onContactUpdated: (contact: ContactWithRelations) => void;
}) {
  const [contactSearch, setContactSearch] = useState("");
  const [contact, setContact] = useState<ContactWithRelations | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A static list has a real, addable membership. A smart list's membership
  // is a computed filter — but when that filter is just "has this tag,"
  // adding someone there is exactly the same as tagging them with it, so
  // those are addable too. A smart list filtered on type/tier/owner/status
  // has no safe way to "add" someone without changing an unrelated field, so
  // those stay excluded.
  const addableLists = useMemo(
    () => lists.filter((e) => e.list.mode === "STATIC" || !!e.list.filterTag),
    [lists]
  );

  function isAlreadyMember(entry: MailingListWithContacts, c: ContactWithRelations): boolean {
    if (entry.list.mode === "STATIC") return entry.list.contactIds.includes(c.id);
    const tag = entry.list.filterTag;
    return !!tag && c.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()));
  }

  const contactMatches = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return [];
    return allContacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [allContacts, contactSearch]);

  function toggleList(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!contact || checked.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      let workingContact = contact;
      for (const listId of checked) {
        const entry = addableLists.find((e) => e.list.id === listId);
        if (!entry || isAlreadyMember(entry, workingContact)) continue;

        if (entry.list.mode === "STATIC") {
          const nextContactIds = [...entry.list.contactIds, workingContact.id];
          const res = await fetch(`/api/lists/${listId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactIds: nextContactIds }),
          });
          const json = await res.json();
          if (!res.ok) {
            setError(json.error ?? "Something went wrong.");
            continue;
          }
          onUpdated({ list: json.list, contacts: json.contacts });
          fetch(`/api/lists/${listId}/tag-members`, { method: "POST" }).catch(() => {});
        } else if (entry.list.filterTag) {
          const nextTags = [...workingContact.tags, entry.list.filterTag];
          const res = await fetch(`/api/contacts/${workingContact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags: nextTags }),
          });
          const json = await res.json();
          if (!res.ok) {
            setError(json.error ?? "Something went wrong.");
            continue;
          }
          workingContact = json.contact;
          onContactUpdated(json.contact);
        }
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add to list</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {done ? (
            <div className="helptext">
              Added {contact?.name} to {checked.size} list{checked.size === 1 ? "" : "s"}.
            </div>
          ) : (
            <>
              <div className="field">
                <label>Contact</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search a contact by name…"
                    value={contact ? contact.name : contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setContact(null);
                    }}
                  />
                  {contactMatches.length > 0 && !contact && (
                    <div
                      className="card"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 5,
                        marginTop: 4,
                        padding: 4,
                        maxHeight: 220,
                        overflow: "auto",
                      }}
                    >
                      {contactMatches.map((c) => (
                        <div
                          key={c.id}
                          className="lookup-row"
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
                          onClick={() => {
                            setContact(c);
                            setContactSearch("");
                          }}
                        >
                          {c.name} {c.org ? <span className="muted">({c.org})</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {contact && (
                <div className="field">
                  <label>Lists ({checked.size} selected)</label>
                  <div className="checkbox-list">
                    {addableLists.length === 0 ? (
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        No addable lists yet — a smart list filtered by contact type, tier, owner, or stage has no
                        safe way to add someone without changing that field, so only static lists and tag-based
                        smart lists show up here.
                      </div>
                    ) : (
                      addableLists.map((entry) => {
                        const alreadyIn = isAlreadyMember(entry, contact);
                        return (
                          <label key={entry.list.id} style={{ opacity: alreadyIn ? 0.55 : 1 }}>
                            <input
                              type="checkbox"
                              checked={checked.has(entry.list.id) || alreadyIn}
                              disabled={alreadyIn}
                              onChange={() => toggleList(entry.list.id)}
                            />
                            {entry.list.name} {entry.list.mode === "DYNAMIC" ? "(smart)" : ""}{" "}
                            {alreadyIn ? "(already in)" : ""}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {error && <div className="error-text">{error}</div>}
            </>
          )}
        </div>
        <div className="modal-foot">
          <span />
          {done ? (
            <button className="btn primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <button className="btn primary" onClick={handleSave} disabled={!contact || checked.size === 0 || saving}>
              {saving ? "Adding…" : "Add to list"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
