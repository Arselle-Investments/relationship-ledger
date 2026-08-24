"use client";

import { useState } from "react";
import { Contact, Correspondence } from "@prisma/client";

function CorrespondenceCard({
  item,
  contacts,
  canEdit,
  onResolved,
}: {
  item: Correspondence;
  contacts: Contact[];
  canEdit: boolean;
  onResolved: (id: string) => void;
}) {
  const [linking, setLinking] = useState(false);
  const [name, setName] = useState(item.extractedName ?? "");
  const [org, setOrg] = useState(item.extractedOrg ?? "");
  const [email, setEmail] = useState(item.extractedEmail ?? "");
  const [existingContactId, setExistingContactId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createNew() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "new", name: name.trim(), org: org.trim() || null, email: email.trim() || null }),
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
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "existing", contactId: existingContactId }),
    });
    setBusy(false);
    if (res.ok) onResolved(item.id);
  }

  async function ignore() {
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IGNORED" }),
    });
    setBusy(false);
    if (res.ok) onResolved(item.id);
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{item.subject || "(no subject)"}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
            {new Date(item.receivedAt).toLocaleString()}
          </div>
        </div>
        <span className="tag forest">suggested contact</span>
      </div>

      <div className="muted" style={{ fontSize: 12.5, marginTop: 10, whiteSpace: "pre-wrap", maxHeight: 100, overflow: "auto" }}>
        {item.bodyText.slice(0, 500)}
      </div>

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
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Organization</label>
              <input value={org} onChange={(e) => setOrg(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
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

export function InboxClient({
  initialSuggested,
  contacts,
  canEdit,
}: {
  initialSuggested: Correspondence[];
  contacts: Contact[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initialSuggested);

  function resolve(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Messages fed from the Fundraising Teams channel that didn&rsquo;t match an existing contact
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <h3>Inbox is clear</h3>
          <div>No suggested contacts waiting on review.</div>
        </div>
      ) : (
        items.map((item) => (
          <CorrespondenceCard key={item.id} item={item} contacts={contacts} canEdit={canEdit} onResolved={resolve} />
        ))
      )}
    </div>
  );
}
