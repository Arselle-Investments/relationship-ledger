"use client";

import { useState } from "react";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-constants";
import { StuckContact } from "@/lib/stuck-contacts";

export function StuckContactsClient({
  initialStuck,
  stuckDays,
  canEdit,
}: {
  initialStuck: StuckContact[];
  stuckDays: number;
  canEdit: boolean;
}) {
  const [stuck] = useState(initialStuck);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);
  const [listName, setListName] = useState("");
  const [listMsg, setListMsg] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generateDrafts() {
    if (selected.size === 0) return;
    setDraftError(null);
    setDrafting(true);
    const res = await fetch("/api/stuck-contacts/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: Array.from(selected) }),
    });
    const json = await res.json().catch(() => ({}));
    setDrafting(false);
    if (!res.ok) {
      setDraftError(json.error ?? "Something went wrong drafting check-ins.");
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      for (const d of json.drafts) next[d.contactId] = d.draft;
      return next;
    });
  }

  async function createList() {
    if (selected.size === 0 || !listName.trim()) return;
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: listName.trim(), mode: "STATIC", contactIds: Array.from(selected) }),
    });
    if (res.ok) {
      setListMsg(`Created "${listName.trim()}" with ${selected.size} contact${selected.size === 1 ? "" : "s"}.`);
      setListName("");
    } else {
      setListMsg("Something went wrong creating the list.");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          No pipeline movement in {stuckDays}+ days &middot; select contacts to draft check-ins or build a mailing list
        </div>
        <div className="spacer" />
        <a className="btn" href="/api/stuck-contacts/export">
          Export to Excel
        </a>
      </div>

      {stuck.length === 0 ? (
        <div className="empty">
          <h3>Nothing stuck</h3>
          <div>Every active contact has moved stages recently.</div>
        </div>
      ) : (
        <>
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                {canEdit && <th></th>}
                <th>Name</th>
                <th>Organization</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>Days in stage</th>
              </tr>
            </thead>
            <tbody>
              {stuck.map((c) => (
                <tr key={c.id}>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                  )}
                  <td className="name-cell">{c.name}</td>
                  <td>{c.org || <span className="muted">—</span>}</td>
                  <td>{CONTACT_STATUS_LABELS[c.status]}</td>
                  <td className="muted">{c.owner?.name || "—"}</td>
                  <td>
                    <span className="overdue-badge">{c.daysInStage}d</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn primary" onClick={generateDrafts} disabled={selected.size === 0 || drafting}>
                  {drafting ? "Drafting…" : `Draft check-ins for ${selected.size || ""} selected`}
                </button>
                <input
                  placeholder="New list name"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  style={{ maxWidth: 220 }}
                />
                <button className="btn" onClick={createList} disabled={selected.size === 0 || !listName.trim()}>
                  Add {selected.size || ""} to mailing list
                </button>
              </div>
              {listMsg && <div className="helptext" style={{ marginTop: 8 }}>{listMsg}</div>}
              {draftError && <div className="error-text" style={{ marginTop: 8 }}>{draftError}</div>}
            </div>
          )}

          {Object.keys(drafts).length > 0 && (
            <div>
              <h3 style={{ marginBottom: 12 }}>Drafted check-ins</h3>
              {stuck
                .filter((c) => drafts[c.id])
                .map((c) => (
                  <div key={c.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{c.name}</div>
                    <textarea
                      readOnly
                      value={drafts[c.id]}
                      style={{ width: "100%", minHeight: 120, fontFamily: "'Work Sans',sans-serif", fontSize: 13 }}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
