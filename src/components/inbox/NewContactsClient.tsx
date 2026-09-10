"use client";

import { useMemo, useState } from "react";
import { Contact, Correspondence } from "@prisma/client";
import { parseSignature } from "@/lib/signature-parse";
import { extractHighlight } from "@/lib/correspondence-highlight";
import { extractEmailFromText } from "@/lib/email-extract";

export type ContactDraft = {
  name: string;
  org: string;
  email: string;
  phone: string;
  city: string;
  title: string;
};

export function draftDefaults(item: Correspondence): ContactDraft {
  return {
    name: item.extractedName ?? "",
    org: item.extractedOrg ?? "",
    // Best-effort auto-fill: prefer whatever the ingestion pipeline already
    // found, otherwise scan the raw body for an email it missed. Still just
    // a starting suggestion — fully editable before the contact is created.
    email: item.extractedEmail ?? extractEmailFromText(item.bodyText) ?? "",
    phone: "",
    city: "",
    title: "",
  };
}

function CorrespondenceCard({
  item,
  contacts,
  canEdit,
  draft,
  onDraftChange,
  selected,
  onToggleSelect,
  onResolved,
  onIgnored,
}: {
  item: Correspondence;
  contacts: Contact[];
  canEdit: boolean;
  draft: ContactDraft;
  onDraftChange: (patch: Partial<ContactDraft>) => void;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onResolved: (id: string) => void;
  onIgnored: (item: Correspondence) => void;
}) {
  const [linking, setLinking] = useState(false);
  const [signatureParsed, setSignatureParsed] = useState(false);
  const [existingContactId, setExistingContactId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const highlight = useMemo(() => extractHighlight(item.bodyText), [item.bodyText]);

  function parseFromSignature() {
    const found = parseSignature(item.bodyText, {
      name: draft.name || item.extractedName,
      email: draft.email || item.extractedEmail,
    });
    setSignatureParsed(true);
    const patch: Partial<ContactDraft> = {};
    if (found.phone) patch.phone = found.phone;
    if (found.title) patch.title = found.title;
    if (found.city) patch.city = found.city;
    if (found.email && !draft.email) patch.email = found.email;
    if (Object.keys(patch).length > 0) onDraftChange(patch);
  }

  async function createNew() {
    setError(null);
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "new",
        name: draft.name.trim(),
        org: draft.org.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        city: draft.city.trim() || null,
        title: draft.title.trim() || null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onResolved(item.id);
  }

  async function linkExisting() {
    if (!existingContactId) return;
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "existing", contactId: existingContactId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onResolved(item.id);
  }

  async function ignore() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IGNORED" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onIgnored({ ...item, status: "IGNORED" as Correspondence["status"] });
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {canEdit && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelect(e.target.checked)}
              style={{ marginTop: 3 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.subject || "(no subject)"}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              {new Date(item.receivedAt).toLocaleString()}
            </div>
          </div>
        </div>
        <span className="tag forest">suggested contact</span>
      </div>

      {highlight ? (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--brass-bg)", borderRadius: 6, fontSize: 12.5 }}>
          <span className="tag brass" style={{ marginRight: 6 }}>New interaction</span>
          {highlight}
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 12.5, marginTop: 10, whiteSpace: "pre-wrap", maxHeight: 100, overflow: "auto" }}>
          {item.bodyText.slice(0, 500)}
        </div>
      )}

      {!canEdit ? (
        <div className="helptext" style={{ marginTop: 10 }}>
          View-only — an editor needs to resolve this.
        </div>
      ) : linking ? (
        <div style={{ marginTop: 12 }}>
          <div className="field-row">
            <div className="field">
              <label>Link to existing contact</label>
              <select value={existingContactId} onChange={(e) => setExistingContactId(e.target.value)}>
                <option value="">— choose —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.org ? `— ${c.org}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small primary" onClick={linkExisting} disabled={!existingContactId || busy}>
              Link
            </button>
            <button className="btn small ghost" onClick={() => setLinking(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="field-row">
            <div className="field">
              <label>Name</label>
              <input value={draft.name} onChange={(e) => onDraftChange({ name: e.target.value })} />
            </div>
            <div className="field">
              <label>Organization</label>
              <input value={draft.org} onChange={(e) => onDraftChange({ org: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Email</label>
            <input value={draft.email} onChange={(e) => onDraftChange({ email: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <button type="button" className="btn small" onClick={parseFromSignature}>
              Pull details from signature
            </button>
            {signatureParsed && !draft.phone && !draft.title && !draft.city && (
              <span className="helptext" style={{ marginLeft: 8 }}>
                Didn&rsquo;t find a phone, title, or location in the message.
              </span>
            )}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Phone</label>
              <input value={draft.phone} onChange={(e) => onDraftChange({ phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Title</label>
              <input value={draft.title} onChange={(e) => onDraftChange({ title: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Location</label>
            <input value={draft.city} onChange={(e) => onDraftChange({ city: e.target.value })} />
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn small primary" onClick={createNew} disabled={busy}>
              Create contact
            </button>
            <button className="btn small" onClick={() => setLinking(true)}>
              Link to existing instead
            </button>
            <button className="btn small btn-danger" onClick={ignore} disabled={busy}>
              Ignore
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NewContactsClient({
  initialSuggested,
  initialIgnored,
  contacts,
  canEdit,
}: {
  initialSuggested: Correspondence[];
  initialIgnored: Correspondence[];
  contacts: Contact[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initialSuggested);
  const [ignoredItems, setIgnoredItems] = useState(initialIgnored);
  const [showIgnored, setShowIgnored] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [contactDrafts, setContactDrafts] = useState<Record<string, ContactDraft>>({});
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactBulkBusy, setContactBulkBusy] = useState(false);
  const [contactBulkMsg, setContactBulkMsg] = useState<string | null>(null);

  function resolve(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function draftFor(item: Correspondence): ContactDraft {
    return contactDrafts[item.id] ?? draftDefaults(item);
  }

  function updateDraft(id: string, patch: Partial<ContactDraft>) {
    setContactDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? draftDefaults(items.find((i) => i.id === id)!)), ...patch } }));
  }

  function toggleSelectContact(id: string, checked: boolean) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllContacts(checked: boolean) {
    setSelectedContactIds(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

  async function createSelectedContacts() {
    setContactBulkBusy(true);
    setContactBulkMsg(null);
    const ids = Array.from(selectedContactIds);
    let created = 0;
    let skipped = 0;
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      const draft = draftFor(item);
      if (!draft.name.trim()) {
        skipped++;
        continue;
      }
      const res = await fetch(`/api/correspondence/${id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "new",
          name: draft.name.trim(),
          org: draft.org.trim() || null,
          email: draft.email.trim() || null,
          phone: draft.phone.trim() || null,
          city: draft.city.trim() || null,
          title: draft.title.trim() || null,
        }),
      });
      if (res.ok) {
        resolve(id);
        created++;
      } else {
        skipped++;
      }
    }
    setContactBulkBusy(false);
    setContactBulkMsg(
      `Created ${created} contact${created === 1 ? "" : "s"}${skipped > 0 ? ` — ${skipped} skipped (missing name or failed)` : ""}.`
    );
  }

  async function ignoreSelectedContacts() {
    setContactBulkBusy(true);
    setContactBulkMsg(null);
    const ids = Array.from(selectedContactIds);
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      const res = await fetch(`/api/correspondence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IGNORED" }),
      });
      if (res.ok) handleIgnored({ ...item, status: "IGNORED" as Correspondence["status"] });
    }
    setContactBulkBusy(false);
  }

  function handleIgnored(item: Correspondence) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setIgnoredItems((prev) => [item, ...prev]);
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  async function undoIgnore(item: Correspondence) {
    setUndoingId(item.id);
    const res = await fetch(`/api/correspondence/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SUGGESTED" }),
    });
    setUndoingId(null);
    if (!res.ok) return;
    setIgnoredItems((prev) => prev.filter((i) => i.id !== item.id));
    setItems((prev) => [item, ...prev]);
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Messages fed from the Fundraising Teams channel that didn&rsquo;t match an existing contact
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <h3>Nothing to review</h3>
          <div>No suggested contacts waiting on review.</div>
        </div>
      ) : (
        <>
          {canEdit && (
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={selectedContactIds.size > 0 && selectedContactIds.size === items.length}
                  onChange={(e) => toggleSelectAllContacts(e.target.checked)}
                />
                Select all
              </label>
              <div className="spacer" />
              <div className="muted" style={{ fontSize: 12.5 }}>
                {selectedContactIds.size > 0 ? `${selectedContactIds.size} selected` : ""}
              </div>
              <button
                className="btn small primary"
                onClick={createSelectedContacts}
                disabled={selectedContactIds.size === 0 || contactBulkBusy}
              >
                {contactBulkBusy ? "Working…" : "Create selected"}
              </button>
              <button
                className="btn small ghost"
                onClick={ignoreSelectedContacts}
                disabled={selectedContactIds.size === 0 || contactBulkBusy}
              >
                Ignore selected
              </button>
            </div>
          )}
          {contactBulkMsg && <div className="helptext" style={{ marginBottom: 12 }}>{contactBulkMsg}</div>}
          {items.map((item) => (
            <CorrespondenceCard
              key={item.id}
              item={item}
              contacts={contacts}
              canEdit={canEdit}
              draft={draftFor(item)}
              onDraftChange={(patch) => updateDraft(item.id, patch)}
              selected={selectedContactIds.has(item.id)}
              onToggleSelect={(checked) => toggleSelectContact(item.id, checked)}
              onResolved={resolve}
              onIgnored={handleIgnored}
            />
          ))}
        </>
      )}

      {canEdit && ignoredItems.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button className="btn small ghost" onClick={() => setShowIgnored((v) => !v)}>
            {showIgnored ? "Hide" : "Show"} ignored ({ignoredItems.length})
          </button>
          {showIgnored && (
            <div style={{ marginTop: 12 }}>
              {ignoredItems.map((item) => (
                <div key={item.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.subject || "(no subject)"}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {new Date(item.receivedAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="tag muted">ignored</span>
                  </div>
                  <div
                    className="muted"
                    style={{ fontSize: 12.5, marginTop: 10, whiteSpace: "pre-wrap", maxHeight: 80, overflow: "auto" }}
                  >
                    {item.bodyText.slice(0, 300)}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn small"
                      onClick={() => undoIgnore(item)}
                      disabled={undoingId === item.id}
                    >
                      {undoingId === item.id ? "Undoing…" : "Undo"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
