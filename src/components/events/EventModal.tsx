"use client";

import { useEffect, useState } from "react";
import { Event, EventType, User } from "@prisma/client";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";

function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

type ConferenceSuggestion = {
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  registrationStatus: string | null;
  registrationLink: string | null;
  registrationOpensAt: string | null;
  dateConfidence: string | null;
  fitNote: string | null;
  summary: string | null;
};

export function EventModal({
  event,
  team,
  canEdit,
  onClose,
  onSaved,
  onDeleted,
  autoRefresh,
}: {
  event: Event | null;
  team: User[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (event: Event) => void;
  onDeleted: (id: string) => void;
  autoRefresh?: boolean;
}) {
  const isEdit = !!event;
  const [name, setName] = useState(event?.name ?? "");
  const [startDate, setStartDate] = useState(event ? isoDate(event.startDate) : new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(event ? isoDate(event.endDate) : new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(event?.location ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? EventType.OTHER);
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(new Set(event?.attendeeIds ?? []));
  const [goals, setGoals] = useState(event?.goals ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [organizer, setOrganizer] = useState(event?.organizer ?? "");
  const [registrationLink, setRegistrationLink] = useState(event?.registrationLink ?? "");
  const [registrationStatus, setRegistrationStatus] = useState(event?.registrationStatus ?? "");
  const [registrationOpensAt, setRegistrationOpensAt] = useState(event?.registrationOpensAt ? isoDate(event.registrationOpensAt) : "");
  const [dateConfidence, setDateConfidence] = useState(event?.dateConfidence ?? "");
  const [fitNote, setFitNote] = useState(event?.fitNote ?? "");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | Date | null>(event?.lastRefreshedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ConferenceSuggestion | null>(null);

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Event name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      startDate,
      endDate: endDate || startDate,
      location: location.trim() || null,
      type,
      attendeeIds: Array.from(attendeeIds),
      goals,
      notes,
      organizer: organizer.trim() || null,
      registrationLink: registrationLink.trim() || null,
      registrationStatus: registrationStatus.trim() || null,
      registrationOpensAt: registrationOpensAt || null,
      dateConfidence: dateConfidence.trim() || null,
      fitNote: fitNote.trim() || null,
    };
    const res = await fetch(isEdit ? `/api/events/${event!.id}` : "/api/events", {
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
    onSaved(isEdit ? json.event : json.event);
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm(`Delete "${event.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(event.id);
  }

  async function handleRefresh() {
    if (!event) return;
    setRefreshError(null);
    setSuggestion(null);
    setRefreshing(true);
    const res = await fetch(`/api/events/${event.id}/refresh`, { method: "POST" });
    const json = await res.json();
    setRefreshing(false);
    if (!res.ok) {
      setRefreshError(json.error ?? "Something went wrong.");
      return;
    }
    setLastRefreshedAt(new Date().toISOString());
    const s = json.suggestion as ConferenceSuggestion;
    const hasAnything =
      s.startDate || s.endDate || s.location || s.registrationStatus || s.registrationLink || s.registrationOpensAt || s.dateConfidence || s.fitNote || s.summary;
    if (!hasAnything) {
      setRefreshError("Checked the registration page — nothing new or different from what's on file.");
      return;
    }
    setSuggestion(s);
  }

  function applySuggestionField(
    field: "startDate" | "endDate" | "location" | "registrationStatus" | "registrationLink" | "registrationOpensAt" | "dateConfidence" | "fitNote"
  ) {
    if (!suggestion) return;
    const value = suggestion[field];
    if (value === null) return;
    if (field === "startDate") setStartDate(value);
    if (field === "endDate") setEndDate(value);
    if (field === "location") setLocation(value);
    if (field === "registrationStatus") setRegistrationStatus(value);
    if (field === "registrationLink") setRegistrationLink(value);
    if (field === "registrationOpensAt") setRegistrationOpensAt(value);
    if (field === "dateConfidence") setDateConfidence(value);
    if (field === "fitNote") setFitNote(value);
    setSuggestion((prev) => (prev ? { ...prev, [field]: null } : prev));
  }

  useEffect(() => {
    if (autoRefresh && event?.registrationLink) {
      handleRefresh();
    }
    // Only ever run once, right when the modal opens with the auto-refresh flag set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "Edit event" : "Add event"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Event name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="field">
              <label>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as EventType)} disabled={!canEdit}>
                {Object.values(EventType).map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Networking goals</label>
            <textarea value={goals} onChange={(e) => setGoals(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Attendees from Arselle</label>
            <div className="checkbox-list">
              {team.map((u) => (
                <label key={u.id}>
                  <input type="checkbox" checked={attendeeIds.has(u.id)} onChange={() => toggleAttendee(u.id)} disabled={!canEdit} />
                  {u.name || u.email}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
          </div>

          <h3 style={{ fontSize: 13, margin: "18px 0 10px" }}>Conference tracking</h3>
          <div className="field-row">
            <div className="field">
              <label>Organizer</label>
              <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="field">
              <label>Registration status</label>
              <input
                value={registrationStatus}
                onChange={(e) => setRegistrationStatus(e.target.value)}
                disabled={!canEdit}
                placeholder="e.g. Registration open"
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Registration link</label>
              <input
                value={registrationLink}
                onChange={(e) => setRegistrationLink(e.target.value)}
                disabled={!canEdit}
                placeholder="https://…"
              />
            </div>
            <div className="field">
              <label>Registration opens</label>
              <input type="date" value={registrationOpensAt} onChange={(e) => setRegistrationOpensAt(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div className="field">
            <label>Fit note</label>
            <input value={fitNote} onChange={(e) => setFitNote(e.target.value)} disabled={!canEdit} placeholder="Why this does/doesn't fit our outreach" />
          </div>

          {isEdit && canEdit && (
            <div className="card" style={{ padding: 12, marginTop: 4, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div className="helptext">
                  {lastRefreshedAt ? `Last checked ${new Date(lastRefreshedAt).toLocaleString()}` : "Never checked automatically."}
                  {dateConfidence ? ` · ${dateConfidence}` : ""}
                </div>
                <button className="btn small" onClick={handleRefresh} disabled={refreshing || !registrationLink.trim()}>
                  {refreshing ? "Checking…" : "Refresh"}
                </button>
              </div>
              {!registrationLink.trim() && <div className="helptext" style={{ marginTop: 6 }}>Add a registration link above to enable checking.</div>}
              {refreshError && <div className="error-text" style={{ marginTop: 8 }}>{refreshError}</div>}
              {suggestion && (
                <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  {suggestion.summary && <div style={{ marginBottom: 8, fontSize: 12.5 }}>{suggestion.summary}</div>}
                  {(
                    [
                      ["startDate", "Start date", suggestion.startDate],
                      ["endDate", "End date", suggestion.endDate],
                      ["location", "Location", suggestion.location],
                      ["registrationStatus", "Registration status", suggestion.registrationStatus],
                      ["registrationLink", "Registration link", suggestion.registrationLink],
                      ["registrationOpensAt", "Registration opens", suggestion.registrationOpensAt],
                      ["dateConfidence", "Confidence", suggestion.dateConfidence],
                      ["fitNote", "Fit note", suggestion.fitNote],
                    ] as const
                  )
                    .filter(([, , value]) => value !== null)
                    .map(([field, label, value]) => (
                      <div
                        key={field}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}
                      >
                        <div style={{ fontSize: 12.5 }}>
                          <strong>{label}:</strong> {value}
                        </div>
                        <button className="btn small ghost" onClick={() => applySuggestionField(field)}>
                          Use this
                        </button>
                      </div>
                    ))}
                  <div style={{ marginTop: 6 }}>
                    <button className="btn small ghost" onClick={() => setSuggestion(null)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className="error-text">{error}</div>}
        </div>
        {canEdit && (
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
        )}
      </div>
    </div>
  );
}
