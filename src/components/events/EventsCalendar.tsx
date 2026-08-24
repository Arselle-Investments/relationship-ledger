"use client";

import { useState } from "react";
import { Event } from "@prisma/client";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";

function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

function eventsOnDate(events: Event[], dateStr: string): Event[] {
  return events.filter((ev) => {
    const start = isoDate(ev.startDate);
    const end = ev.endDate ? isoDate(ev.endDate) : start;
    return start && dateStr >= start && dateStr <= end;
  });
}

function quarterStartMonth(m: number) {
  return Math.floor(m / 3) * 3;
}

function MonthGrid({
  year,
  month,
  events,
  onDayClick,
}: {
  year: number;
  month: number;
  events: Event[];
  onDayClick: (dateStr: string, dayEvents: Event[]) => void;
}) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = first.toLocaleDateString("en-US", { month: "long" });
  const today = new Date().toISOString().slice(0, 10);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`pad-${i}`} className="cal-day pad" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayEvents = eventsOnDate(events, dateStr);
    const isToday = dateStr === today;
    cells.push(
      <div
        key={dateStr}
        className={`cal-day ${dayEvents.length ? "has-event" : ""} ${isToday ? "today" : ""}`}
        onClick={dayEvents.length ? () => onDayClick(dateStr, dayEvents) : undefined}
      >
        <span>{d}</span>
        {dayEvents.length > 0 && (
          <div className="dots">
            {dayEvents.slice(0, 3).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cal-month">
      <h4>
        {monthName} {year}
      </h4>
      <div className="cal-weekdays">
        <div>S</div>
        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
      </div>
      <div className="cal-days">{cells}</div>
    </div>
  );
}

export function EventsCalendar({ events }: { events: Event[] }) {
  const [span, setSpan] = useState<"quarter" | "year">("quarter");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dayModal, setDayModal] = useState<{ dateStr: string; events: Event[] } | null>(null);

  const year = anchor.getFullYear();
  const months = span === "quarter" ? [0, 1, 2].map((i) => quarterStartMonth(anchor.getMonth()) + i) : Array.from({ length: 12 }, (_, i) => i);
  const label = span === "quarter" ? `Q${quarterStartMonth(anchor.getMonth()) / 3 + 1} ${year}` : `${year}`;

  function shift(dir: 1 | -1) {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (span === "quarter") next.setMonth(next.getMonth() + dir * 3);
      else next.setFullYear(next.getFullYear() + dir);
      return next;
    });
  }

  return (
    <div>
      <div className="toolbar">
        <div className="view-toggle">
          <button className={span === "quarter" ? "active" : ""} onClick={() => setSpan("quarter")}>
            Quarter
          </button>
          <button className={span === "year" ? "active" : ""} onClick={() => setSpan("year")}>
            Year
          </button>
        </div>
        <div className="cal-nav">
          <button onClick={() => shift(-1)}>&#8249;</button>
          <div className="cal-label">{label}</div>
          <button onClick={() => shift(1)}>&#8250;</button>
        </div>
      </div>
      <div id="cal-grid" className={span}>
        {months.map((m) => (
          <MonthGrid
            key={m}
            year={year}
            month={m}
            events={events}
            onDayClick={(dateStr, dayEvents) => setDayModal({ dateStr, events: dayEvents })}
          />
        ))}
      </div>

      {dayModal && (
        <div className="overlay open" onClick={() => setDayModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{new Date(dayModal.dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</h2>
              <button className="close-x" onClick={() => setDayModal(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {dayModal.events.map((ev) => (
                <div key={ev.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 600 }}>{ev.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {ev.location} &middot; {EVENT_TYPE_LABELS[ev.type]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
