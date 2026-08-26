"use client";

import { useState } from "react";
import { TravelWithUser } from "@/lib/travel";
import { TripCard } from "./TripCard";

export function TravelClient({
  initialTravel,
  currentUserId,
  canEdit,
}: {
  initialTravel: TravelWithUser[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [trips, setTrips] = useState(initialTravel);
  const [adding, setAdding] = useState(false);
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function removeLocal(id: string) {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleAdd() {
    setError(null);
    if (!city.trim() || !startDate) {
      setError("City and start date are required.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: city.trim(), startDate, endDate: endDate || startDate, notes }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setTrips((prev) => [...prev, json.trip].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
    setCity("");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setAdding(false);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Team travel plans &mdash; matched against contacts&rsquo; city on file
        </div>
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add trip"}
          </button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="field-row">
            <div className="field">
              <label>City</label>
              <input placeholder="e.g. Austin, TX" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field">
              <label>Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
          <button className="btn primary" onClick={handleAdd} disabled={saving}>
            {saving ? "Saving…" : "Save trip"}
          </button>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="empty">
          <h3>No upcoming travel</h3>
          <div>Add a trip to see which contacts are based where you&rsquo;re headed.</div>
        </div>
      ) : (
        trips.map((t) => (
          <TripCard key={t.id} trip={t} currentUserId={currentUserId} canEdit={canEdit} onDeleted={removeLocal} />
        ))
      )}
    </div>
  );
}
