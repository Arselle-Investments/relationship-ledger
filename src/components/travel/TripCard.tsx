"use client";

import { useRef, useState } from "react";
import { ContactWithRelations } from "@/types/contact";
import { CompanyTravelMatch, TravelWithUser } from "@/lib/travel";
import { buildGenericTravelEmail } from "@/lib/travel-templates";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// AI personalization is worth the credits for a handful of contacts; past
// this many, default to the free generic template instead (still overridable).
const AI_DEFAULT_THRESHOLD = 5;

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
  const [companyMatches, setCompanyMatches] = useState<CompanyTravelMatch[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [findTaskMsg, setFindTaskMsg] = useState<Record<string, string>>({});
  const [findTaskBusy, setFindTaskBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState(false);
  const [listName, setListName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const aiTouched = useRef(false);
  const [combine, setCombine] = useState(false);
  const [combinedDraft, setCombinedDraft] = useState<string | null>(null);
  const [mailtoNotice, setMailtoNotice] = useState<string | null>(null);

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && matches === null) {
      const res = await fetch(`/api/travel/${trip.id}/matches`);
      const json = await res.json();
      setMatches(json.contacts ?? []);
      setCompanyMatches(json.companies ?? []);
    }
  }

  async function createFindContactTask(companyName: string) {
    setFindTaskBusy(companyName);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Find a contact at ${companyName} in ${trip.city}`,
        assigneeIds: [currentUserId],
        dueDate: startDateIso,
        priority: "MEDIUM",
        notes: `No contact on file at ${companyName} in ${trip.city} yet — research on LinkedIn, Fintrix, or similar before the trip (${fmtDate(trip.startDate)}–${fmtDate(trip.endDate)}).`,
      }),
    });
    setFindTaskBusy(null);
    setFindTaskMsg((prev) => ({
      ...prev,
      [companyName]: res.ok ? "Task created." : "Something went wrong creating the task.",
    }));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!aiTouched.current) setUseAI(next.size > 0 && next.size <= AI_DEFAULT_THRESHOLD);
      return next;
    });
  }

  const startDateIso = new Date(trip.startDate).toISOString().slice(0, 10);
  const endDateIso = new Date(trip.endDate).toISOString().slice(0, 10);
  const travelerName = trip.user.name || trip.user.email || "the team";

  function generateGenericDrafts() {
    if (!matches) return;
    const next: Record<string, string> = { ...drafts };
    for (const id of selected) {
      const c = matches.find((m) => m.id === id);
      if (!c) continue;
      next[id] = buildGenericTravelEmail({
        contactName: c.name,
        travelerName,
        city: trip.city,
        startDate: startDateIso,
        endDate: endDateIso,
      });
    }
    setDrafts(next);
  }

  function generateCombinedDraft() {
    setCombinedDraft(
      buildGenericTravelEmail({ contactName: null, travelerName, city: trip.city, startDate: startDateIso, endDate: endDateIso })
    );
  }

  async function generateDrafts() {
    if (selected.size === 0) return;
    if (combine) {
      generateCombinedDraft();
      return;
    }
    if (!useAI) {
      generateGenericDrafts();
      return;
    }
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

  async function copyEmails() {
    if (!matches) return;
    const emails = matches.filter((c) => selected.has(c.id) && c.email).map((c) => c.email as string);
    if (emails.length === 0) {
      setMsg("None of the selected contacts have an email on file.");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setMsg(`Copied ${emails.length} email${emails.length === 1 ? "" : "es"} to the clipboard.`);
    } catch {
      setMsg("Couldn't copy to the clipboard. Check the browser's clipboard permission and try again.");
    }
  }

  function mailtoBody(): string | null {
    if (combine) return combinedDraft;
    if (!useAI && selected.size > 0) {
      return buildGenericTravelEmail({ contactName: null, travelerName, city: trip.city, startDate: startDateIso, endDate: endDateIso });
    }
    return null;
  }

  function mailtoHref(): string {
    if (!matches) return "mailto:";
    const emails = matches.filter((c) => selected.has(c.id) && c.email).map((c) => c.email as string);
    const params = new URLSearchParams();
    if (emails.length > 0) params.set("bcc", emails.join(","));
    const body = mailtoBody();
    if (body) params.set("body", body);
    return `mailto:?${params.toString()}`;
  }

  // mailto: links can fail silently — no default mail client registered, or
  // (with many BCC recipients plus a body) the URL simply exceeds what the
  // OS/browser will hand off. Always copy the addresses as a fallback the
  // user can paste in manually, so the click does *something* visible either way.
  async function handleMailtoClick() {
    if (!matches) return;
    const emails = matches.filter((c) => selected.has(c.id) && c.email).map((c) => c.email as string);
    if (emails.length === 0) return;
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setMailtoNotice(`Also copied ${emails.length} email${emails.length === 1 ? "" : "es"} to the clipboard, in case your email client didn't open.`);
    } catch {
      // Clipboard permission denied — the mailto: attempt still stands on its own.
    }
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
          {companyMatches && companyMatches.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Companies based in {trip.city}</div>
              {companyMatches.map(({ company, contacts: companyContacts }) => (
                <div key={company.id} style={{ marginBottom: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{company.name}</span>
                  {companyContacts.length > 0 ? (
                    <span className="muted"> &mdash; {companyContacts.map((c) => c.name).join(", ")}</span>
                  ) : (
                    <>
                      <span className="muted"> &mdash; no contact on file here yet</span>
                      {canEdit && (
                        <button
                          className="btn small ghost"
                          style={{ marginLeft: 8 }}
                          onClick={() => createFindContactTask(company.name)}
                          disabled={findTaskBusy === company.name}
                        >
                          {findTaskBusy === company.name ? "Creating…" : "Create task to find a contact"}
                        </button>
                      )}
                      {findTaskMsg[company.name] && (
                        <span className="helptext" style={{ marginLeft: 8 }}>{findTaskMsg[company.name]}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
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
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={useAI}
                      disabled={combine}
                      onChange={(e) => {
                        aiTouched.current = true;
                        setUseAI(e.target.checked);
                      }}
                    />
                    Personalize with AI (uses AI credits, off by default past {AI_DEFAULT_THRESHOLD} contacts
                    {combine ? ", unavailable when combining into one email" : ""})
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={combine}
                      onChange={(e) => {
                        setCombine(e.target.checked);
                        setCombinedDraft(null);
                      }}
                    />
                    Combine into one email for everyone selected (sent as a single BCC, not personalized per person)
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="btn small primary" onClick={generateDrafts} disabled={selected.size === 0 || drafting}>
                      {drafting ? "Drafting…" : combine ? `Draft combined message for ${selected.size || ""} selected` : `Draft outreach for ${selected.size || ""} selected`}
                    </button>
                    <button className="btn small" onClick={copyEmails} disabled={selected.size === 0}>
                      Copy emails
                    </button>
                    <a
                      className="btn small"
                      style={selected.size === 0 ? { opacity: 0.5, pointerEvents: "none" } : undefined}
                      href={selected.size === 0 ? undefined : mailtoHref()}
                      onClick={handleMailtoClick}
                    >
                      Email selected (BCC)
                    </a>
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
                </div>
              )}
              {msg && <div className="helptext" style={{ marginTop: 8 }}>{msg}</div>}
              {mailtoNotice && <div className="helptext" style={{ marginTop: 8 }}>{mailtoNotice}</div>}
              {draftError && <div className="error-text" style={{ marginTop: 8 }}>{draftError}</div>}

              {combine && combinedDraft ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                    Combined message ({selected.size} recipient{selected.size === 1 ? "" : "s"}, BCC)
                  </div>
                  <textarea
                    readOnly
                    value={combinedDraft}
                    style={{ width: "100%", minHeight: 100, fontFamily: "'Work Sans',sans-serif", fontSize: 13 }}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                </div>
              ) : (
                Object.keys(drafts).length > 0 && (
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
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
