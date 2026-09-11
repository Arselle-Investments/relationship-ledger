"use client";

import { useMemo, useState } from "react";
import { Contact, Correspondence } from "@prisma/client";
import { parseSignature } from "@/lib/signature-parse";
import { extractHighlight } from "@/lib/correspondence-highlight";
import { extractEmailFromText, guessNameFromEmail } from "@/lib/email-extract";

export type ContactDraft = {
  name: string;
  org: string;
  email: string;
  phone: string;
  city: string;
  title: string;
};

/** How many of the six draft fields actually have something in them — used to sort "most filled-in first." */
export function draftCompleteness(draft: ContactDraft): number {
  return [draft.name, draft.org, draft.email, draft.phone, draft.city, draft.title].filter((v) => v.trim()).length;
}

export function draftDefaults(item: Correspondence): ContactDraft {
  // Best-effort auto-fill, applied up front rather than waiting on a manual
  // "pull from signature" click: prefer whatever the ingestion pipeline
  // already found, then a raw-body email scan, then a signature-block parse.
  // Still just a starting suggestion — fully editable before the contact is
  // created.
  const signature = parseSignature(item.bodyText, { name: item.extractedName, email: item.extractedEmail });
  const email = item.extractedEmail ?? extractEmailFromText(item.bodyText) ?? signature.email ?? "";
  // A name buried nowhere in the message but implied by "firstname.lastname@"
  // is still better than leaving the field blank for a human to guess at.
  const name = item.extractedName ?? (email ? guessNameFromEmail(email) ?? "" : "");
  return {
    name,
    org: item.extractedOrg ?? "",
    email,
    phone: signature.phone ?? "",
    city: signature.city ?? "",
    title: signature.title ?? "",
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
  const [existingSearch, setExistingSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const highlight = useMemo(() => extractHighlight(item.bodyText), [item.bodyText]);

  const existingMatches = useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    const pool = q
      ? contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.org ?? "").toLowerCase().includes(q))
      : contacts;
    return pool.slice(0, 25);
  }, [contacts, existingSearch]);

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
        <div
          className="muted"
          style={{
            fontSize: 12.5,
            marginTop: 10,
            whiteSpace: "pre-wrap",
            maxHeight: showFullMessage ? "none" : draft.email ? 100 : 260,
            overflow: "auto",
          }}
        >
          {showFullMessage ? item.bodyText : item.bodyText.slice(0, draft.email ? 500 : 3000)}
        </div>
      )}
      {!draft.email && (
        <div className="helptext" style={{ marginTop: 6 }}>
          No email found automatically — the fuller message above is shown so you can look for one by hand.
        </div>
      )}
      {item.bodyText.length > (draft.email ? 500 : 3000) && (
        <button
          type="button"
          className="btn small ghost"
          style={{ marginTop: 6 }}
          onClick={() => setShowFullMessage((v) => !v)}
        >
          {showFullMessage ? "Show less" : "Show full message"}
        </button>
      )}

      {!canEdit ? (
        <div className="helptext" style={{ marginTop: 10 }}>
          View-only. An editor needs to resolve this.
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
            <button
              className="btn small"
              onClick={() => {
                setLinking((v) => !v);
                setExistingContactId("");
              }}
            >
              {linking ? "Cancel linking" : "Link to existing instead"}
            </button>
            <button className="btn small btn-danger" onClick={ignore} disabled={busy}>
              Ignore
            </button>
          </div>

          {linking && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--paper)", borderRadius: 8 }}>
              <input
                type="text"
                placeholder="Search existing contacts by name or org…"
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
                style={{ marginBottom: 8, width: "100%" }}
              />
              <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 10 }}>
                {existingMatches.length === 0 ? (
                  <div className="helptext" style={{ padding: 10 }}>
                    No contacts match.
                  </div>
                ) : (
                  existingMatches.map((c) => (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        fontSize: 13,
                        cursor: "pointer",
                        background: existingContactId === c.id ? "var(--brass-bg)" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={`link-existing-${item.id}`}
                        checked={existingContactId === c.id}
                        onChange={() => setExistingContactId(c.id)}
                      />
                      {c.name}
                      {c.org && <span className="muted">&middot; {c.org}</span>}
                      {c.email && <span className="muted">&middot; {c.email}</span>}
                    </label>
                  ))
                )}
              </div>
              <button className="btn small primary" onClick={linkExisting} disabled={!existingContactId || busy}>
                {busy ? "Linking…" : "Link to selected"}
              </button>
            </div>
          )}
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
  const [emailOnly, setEmailOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"newest" | "name" | "completeness">("newest");

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

  const visibleItems = useMemo(() => {
    const filtered = emailOnly ? items.filter((i) => draftFor(i).email.trim()) : items;
    const sorted = [...filtered];
    if (sortKey === "name") {
      sorted.sort((a, b) => draftFor(a).name.localeCompare(draftFor(b).name));
    } else if (sortKey === "completeness") {
      sorted.sort((a, b) => draftCompleteness(draftFor(b)) - draftCompleteness(draftFor(a)));
    } else {
      sorted.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    }
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, emailOnly, sortKey, contactDrafts]);

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
    setSelectedContactIds(checked ? new Set(visibleItems.map((i) => i.id)) : new Set());
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
      `Created ${created} contact${created === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} skipped: missing name or failed)` : ""}.`
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
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="num">{items.length}</div>
          <div className="label">Suggested contacts</div>
        </div>
      </div>
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
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <input type="checkbox" checked={emailOnly} onChange={(e) => setEmailOnly(e.target.checked)} />
              Only show ones with an email
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              Sort by
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
                <option value="newest">Newest first</option>
                <option value="name">Name (A-Z)</option>
                <option value="completeness">Most data available</option>
              </select>
            </label>
            <div className="spacer" />
            <div className="muted" style={{ fontSize: 12.5 }}>
              {visibleItems.length} of {items.length}
            </div>
          </div>
          {canEdit && visibleItems.length > 0 && (
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={selectedContactIds.size > 0 && selectedContactIds.size === visibleItems.length}
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
          {visibleItems.length === 0 ? (
            <div className="empty">
              <h3>No matches</h3>
              <div>Nothing waiting on review has an email on file.</div>
            </div>
          ) : (
          visibleItems.map((item) => (
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
          ))
          )}
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
