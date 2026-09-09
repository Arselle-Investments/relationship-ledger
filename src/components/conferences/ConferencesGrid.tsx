"use client";

import { Conference } from "@prisma/client";
import { CONFERENCE_TYPE_LABELS } from "@/lib/conference-constants";

function fmtDate(d: Date | string) {
  const dt = new Date(d);
  // Dates are stored as UTC midnight for a calendar day with no time component —
  // format in UTC too, or a negative-offset timezone shows the previous day.
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function ConferencesGrid({
  conferences,
  attendeeNamesById,
  onClickConference,
  onRefreshConference,
}: {
  conferences: Conference[];
  attendeeNamesById: Map<string, string>;
  onClickConference: (conference: Conference) => void;
  onRefreshConference?: (conference: Conference) => void;
}) {
  if (conferences.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing to show</h3>
        <div>No conferences match the current filter.</div>
      </div>
    );
  }

  const sorted = [...conferences].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const seriesCounts = new Map<string, number>();
  for (const c of conferences) {
    const key = c.seriesId ?? c.id;
    seriesCounts.set(key, (seriesCounts.get(key) ?? 0) + 1);
  }

  return (
    <div id="conferences-grid">
      {sorted.map((ev) => {
        const seriesKey = ev.seriesId ?? ev.id;
        const seriesSize = seriesCounts.get(seriesKey) ?? 1;
        return (
        <div key={ev.id} className="conference-card" onClick={() => onClickConference(ev)}>
          <div className="dates">
            {fmtDate(ev.startDate)}
            {ev.endDate && isoDate(ev.endDate) !== isoDate(ev.startDate) ? ` – ${fmtDate(ev.endDate)}` : ""}
          </div>
          <h3>{ev.name}</h3>
          <div className="loc">
            {ev.location} &middot; <span className="tag">{CONFERENCE_TYPE_LABELS[ev.type]}</span>
            {seriesSize > 1 && (
              <span className="tag forest" title="This conference recurs — other years are tracked as separate entries linked to this one">
                Recurring &middot; {seriesSize} years on file
              </span>
            )}
          </div>
          {ev.registrationStatus && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {ev.registrationStatus}
            </div>
          )}
          {ev.goals && <div className="muted" style={{ fontSize: 12.5 }}>{ev.goals}</div>}
          {ev.registrationLink && onRefreshConference && (
            <button
              className="btn small ghost"
              style={{ marginTop: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                onRefreshConference(ev);
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
        );
      })}
    </div>
  );
}

function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}
