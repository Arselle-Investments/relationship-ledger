"use client";

import { useState } from "react";
import { ContactWithRelations } from "@/types/contact";
import { TravelWithUser } from "@/lib/travel";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function TripCard({
  trip,
  currentUserId,
  canEdit,
  onDeleted,
}: {
  trip: TravelWithUser;
  currentUserId: string;
  canEdit: boolean;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [matches, setMatches] = useState<ContactWithRelations[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);
  const [listName, setListName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && matches === null) {
      const res = await fetch(`/api/travel/${trip.id}/matches`);
      const json = await res.json();
      setMatches(json.contacts ?? []);
    }
  }

  function toggleSelect(id: string) {
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
    const res = await fetch(`/api/travel/${trip.id}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: Array.from(selected) }),
    });
    const json = await res.json().catch(() => ({}));
    setDrafting(false);
    if (!res.ok) {
      setDraftError(json.error ?? "Something went wrong drafting outreach.");
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
      setMsg(`Created "${listName.trim()}" with ${selected.size} contact${selected.size === 1 ? "" : "s"}.`);
      setListName("");
    } else {
      setMsg("Something went wrong creating the list.");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete this trip to ${trip.city}?`)) return;
    const res = await fetch(`/api/travel/${trip.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(trip.id);
  }

  const isMine = trip.userId === currentUserId;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{trip.city}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} &middot; {trip.user.name || trip.user.email}
            {isMine && <span className="tag brass" style={{ marginLeft: 6 }}>you</span>}
          </div>
          {trip.notes && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{trip.notes}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, flex: "none" }}>
          <button className="btn small" onClick={toggleExpand}>
            {expanded ? "Hide contacts" : "See matching contacts"}
          </button>
          {canEdit && isMine && (
            <button className="btn small btn-danger" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          {matches === null ? (
            <div className="muted" style={{ fontSize: 12.5 }}>Loading…</div>
          ) : matches.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>No contacts on file based in {trip.city}.</div>
          ) : (
            <>
              <table style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    {canEdit && <th></th>}
                    <th>Name</th>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((c) => (
                    <tr key={c.id}>
                      {canEdit && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                        </td>
                      )}
                      <td className="name-cell">{c.name}</td>
                      <td>{c.org || <span className="muted">—</span>}</td>
                      <td className="muted">{c.status.replace(/_/g, " ").toLowerCase()}</td>
                      <td className="muted">{c.owner?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {canEdit && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button className="btn small primary" onClick={generateDrafts} disabled={selected.size === 0 || drafting}>
                    {drafting ? "Drafting…" : `Draft outreach for ${selected.size || ""} selected`}
                  </button>
                  <input
                    placeholder="New list name"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    style={{ maxWidth: 200 }}
                  />
                  <button className="btn small" onClick={createList} disabled={selected.size === 0 || !listName.trim()}>
                    Add to mailing list
                  </button>
                </div>
              )}
              {msg && <div className="helptext" style={{ marginTop: 8 }}>{msg}</div>}
              {draftError && <div className="error-text" style={{ marginTop: 8 }}>{draftError}</div>}

              {Object.keys(drafts).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  {matches
                    .filter((c) => drafts[c.id])
                    .map((c) => (
                      <div key={c.id} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
                        <textarea
                          readOnly
                          value={drafts[c.id]}
                          style={{ width: "100%", minHeight: 100, fontFamily: "'Work Sans',sans-serif", fontSize: 13 }}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
