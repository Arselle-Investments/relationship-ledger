"use client";

import { Event } from "@prisma/client";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";

function fmtDate(d: Date | string) {
  const dt = new Date(d);
  // Dates are stored as UTC midnight for a calendar day with no time component —
  // format in UTC too, or a negative-offset timezone shows the previous day.
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function EventsGrid({
  events,
  attendeeNamesById,
  onClickEvent,
  onRefreshEvent,
}: {
  events: Event[];
  attendeeNamesById: Map<string, string>;
  onClickEvent: (event: Event) => void;
  onRefreshEvent?: (event: Event) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing to show</h3>
        <div>No events match the current filter.</div>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <div id="events-grid">
      {sorted.map((ev) => (
        <div key={ev.id} className="event-card" onClick={() => onClickEvent(ev)}>
          <div className="dates">
            {fmtDate(ev.startDate)}
            {ev.endDate && isoDate(ev.endDate) !== isoDate(ev.startDate) ? ` – ${fmtDate(ev.endDate)}` : ""}
          </div>
          <h3>{ev.name}</h3>
          <div className="loc">
            {ev.location} &middot; <span className="tag">{EVENT_TYPE_LABELS[ev.type]}</span>
          </div>
          {ev.registrationStatus && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {ev.registrationStatus}
            </div>
          )}
          {ev.goals && <div className="muted" style={{ fontSize: 12.5 }}>{ev.goals}</div>}
          {ev.registrationLink && onRefreshEvent && (
            <button
              className="btn small ghost"
              style={{ marginTop: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                onRefreshEvent(ev);
              }}
            >
              Check for updates
            </button>
          )}
          {ev.attendeeIds.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {ev.attendeeIds.map((id) => (
                <span key={id} className="tag brass">
                  {attendeeNamesById.get(id) ?? "?"}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}
