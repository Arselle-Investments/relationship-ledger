"use client";

import { useState } from "react";
import { Event, EventType, User } from "@prisma/client";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";

function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

export function EventModal({
  event,
  team,
  canEdit,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: Event | null;
  team: User[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (event: Event) => void;
  onDeleted: (id: string) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
