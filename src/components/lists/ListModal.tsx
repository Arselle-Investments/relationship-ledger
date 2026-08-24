"use client";

import { useState } from "react";
import { ContactTier, ContactType, MailingList, MailingListMode, User } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { MailingListWithContacts } from "@/types/mailing-list";

export function ListModal({
  entry,
  allContacts,
  team,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: MailingListWithContacts | null;
  allContacts: ContactWithRelations[];
  team: User[];
  onClose: () => void;
  onSaved: (entry: MailingListWithContacts) => void;
  onDeleted: (id: string) => void;
}) {
  const isEdit = !!entry;
  const [name, setName] = useState(entry?.list.name ?? "");
  const [description, setDescription] = useState(entry?.list.description ?? "");
  const [mode, setMode] = useState<MailingListMode>(entry?.list.mode ?? MailingListMode.STATIC);
  const [contactIds, setContactIds] = useState<Set<string>>(new Set(entry?.list.contactIds ?? []));
  const [filterType, setFilterType] = useState(entry?.list.filterType ?? "");
  const [filterTier, setFilterTier] = useState(entry?.list.filterTier ?? "");
  const [filterOwnerId, setFilterOwnerId] = useState(entry?.list.filterOwnerId ?? "");
  const [filterTag, setFilterTag] = useState(entry?.list.filterTag ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleContact(id: string) {
    setContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      mode,
      contactIds: mode === MailingListMode.STATIC ? Array.from(contactIds) : [],
      filterType: mode === MailingListMode.DYNAMIC ? filterType || null : null,
      filterTier: mode === MailingListMode.DYNAMIC ? filterTier || null : null,
      filterOwnerId: mode === MailingListMode.DYNAMIC ? filterOwnerId || null : null,
      filterTag: mode === MailingListMode.DYNAMIC ? filterTag.trim() || null : null,
    };

    const res = await fetch(isEdit ? `/api/lists/${entry!.list.id}` : "/api/lists", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    if (isEdit) {
      onSaved({ list: json.list, contacts: json.contacts });
    } else {
      // Freshly created lists don't get contacts back from POST; compute is trivial client-side.
      const contacts =
        mode === MailingListMode.STATIC
          ? allContacts.filter((c) => contactIds.has(c.id))
          : allContacts.filter((c) => {
              if (filterType && c.type !== filterType) return false;
              if (filterTier && c.tier !== filterTier) return false;
              if (filterOwnerId && c.ownerId !== filterOwnerId) return false;
              if (filterTag && !c.tags.some((t) => t.toLowerCase().includes(filterTag.toLowerCase()))) return false;
              return true;
            });
      onSaved({ list: json.list as MailingList, contacts });
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (!confirm(`Delete "${entry.list.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/lists/${entry.list.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(entry.list.id);
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "Edit list" : "Create list"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as MailingListMode)}>
              <option value={MailingListMode.STATIC}>Static — pick specific contacts</option>
              <option value={MailingListMode.DYNAMIC}>Smart — saved filter, always current</option>
            </select>
          </div>

          {mode === MailingListMode.STATIC ? (
            <div className="field">
              <label>Contacts ({contactIds.size} selected)</label>
              <div className="checkbox-list">
                {allContacts.map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={contactIds.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                    />
                    {c.name} {c.org ? `— ${c.org}` : ""}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Type</label>
                  <select value={filterType ?? ""} onChange={(e) => setFilterType(e.target.value as ContactType | "")}>
                    <option value="">Any</option>
                    {Object.values(ContactType).map((t) => (
                      <option key={t} value={t}>
                        {CONTACT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tier</label>
                  <select value={filterTier ?? ""} onChange={(e) => setFilterTier(e.target.value as ContactTier | "")}>
                    <option value="">Any</option>
                    {Object.values(ContactTier).map((t) => (
                      <option key={t} value={t}>
                        {CONTACT_TIER_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Owner</label>
                  <select value={filterOwnerId ?? ""} onChange={(e) => setFilterOwnerId(e.target.value)}>
                    <option value="">Any</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tag contains</label>
                  <input value={filterTag} onChange={(e) => setFilterTag(e.target.value)} />
                </div>
              </div>
              <div className="helptext">Smart lists recompute membership live every time they&rsquo;re viewed.</div>
            </>
          )}

          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-foot">
          {isEdit ? (
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
