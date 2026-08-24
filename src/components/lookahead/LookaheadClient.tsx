"use client";

import { useMemo, useState } from "react";
import { Settings } from "@prisma/client";
import { getOverdueContacts } from "@/lib/followups";
import { getOverdueSequenceContacts, getUpcomingSequenceItems } from "@/lib/sequences";
import { getUpcomingCadenceContacts, windowBounds } from "@/lib/lookahead";
import { eventOverlapsWindow } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/event-constants";
import { TASK_STATUS_LABELS } from "@/lib/task-constants";
import { ContactWithRelations } from "@/types/contact";
import { TaskWithRelations } from "@/types/task";
import { Event as EventModel } from "@prisma/client";

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function LookaheadClient({
  contacts,
  tasks,
  events,
  settings,
}: {
  contacts: ContactWithRelations[];
  tasks: TaskWithRelations[];
  events: EventModel[];
  settings: Settings;
}) {
  const [windowDays, setWindowDays] = useState<14 | 30>(14);

  const bounds = useMemo(() => windowBounds(windowDays), [windowDays]);
  const today = new Date().toISOString().slice(0, 10);

  const requiredCadence = useMemo(() => getOverdueContacts(contacts, settings.defaultCadenceDays), [contacts, settings]);
  const requiredSeq = useMemo(() => getOverdueSequenceContacts(contacts), [contacts]);
  const recommendedSeq = useMemo(() => getUpcomingSequenceItems(contacts, bounds.end), [contacts, bounds]);
  const recommendedCadence = useMemo(
    () => getUpcomingCadenceContacts(contacts, settings.defaultCadenceDays, bounds.end),
    [contacts, settings, bounds]
  );
  const milestones = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate).toISOString().slice(0, 10) <= bounds.end)
        .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0)),
    [tasks, bounds]
  );
  const conferences = useMemo(
    () =>
      events
        .filter((ev) => eventOverlapsWindow(ev, bounds))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [events, bounds]
  );

  const windowLabel = windowDays === 14 ? "next 2 weeks" : "next 30 days";

  return (
    <div>
      <div className="toolbar">
        <div className="view-toggle">
          <button className={windowDays === 14 ? "active" : ""} onClick={() => setWindowDays(14)}>
            Next 2 weeks
          </button>
          <button className={windowDays === 30 ? "active" : ""} onClick={() => setWindowDays(30)}>
            Next 30 days
          </button>
        </div>
        <div className="spacer" />
        <a className="btn" href={`/api/lookahead/export?days=${windowDays}`}>
          Export to Excel
        </a>
      </div>

      <div className="eyebrow" style={{ marginBottom: 14 }}>
        At a glance for the {windowLabel} &middot; {fmtDate(bounds.start)} to {fmtDate(bounds.end)}
      </div>

      <Section title="Required follow-ups (overdue now)" count={requiredCadence.length + requiredSeq.length} emptyMsg="Nothing overdue right now.">
        {requiredCadence.length + requiredSeq.length > 0 && (
          <table>
            <tbody>
              {requiredCadence.map((c) => (
                <tr key={`cad-${c.id}`}>
                  <td className="name-cell">{c.name}</td>
                  <td>{c.org || <span className="muted">—</span>}</td>
                  <td className="muted">{c.owner?.name || "—"}</td>
                  <td>
                    <span className="overdue-badge">{c.daysOverdue + c.cadence}d since contact, overdue on cadence</span>
                  </td>
                </tr>
              ))}
              {requiredSeq.map((c) => (
                <tr key={`seq-${c.id}`}>
                  <td className="name-cell">{c.name}</td>
                  <td>{c.org || <span className="muted">—</span>}</td>
                  <td className="muted">{c.owner?.name || "—"}</td>
                  <td>
                    <span className="overdue-badge">
                      sequence step &ldquo;{c.step.title}&rdquo; due {c.step.dueDate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Recommended outreach (due this window)"
        count={recommendedSeq.length + recommendedCadence.length}
        emptyMsg="No outreach due in this window yet."
      >
        {recommendedSeq.length + recommendedCadence.length > 0 && (
          <table>
            <tbody>
              {recommendedSeq.map((r) => (
                <tr key={`seq-${r.id}`}>
                  <td className="name-cell">{r.name}</td>
                  <td>{r.org || <span className="muted">—</span>}</td>
                  <td className="muted">{r.owner?.name || "—"}</td>
                  <td className="muted">
                    {r.step.title} due {r.step.dueDate}
                  </td>
                </tr>
              ))}
              {recommendedCadence.map((c) => {
                const cadence = c.cadenceOverrideDays ?? settings.defaultCadenceDays;
                return (
                  <tr key={`cad-${c.id}`}>
                    <td className="name-cell">{c.name}</td>
                    <td>{c.org || <span className="muted">—</span>}</td>
                    <td className="muted">{c.owner?.name || "—"}</td>
                    <td className="muted">cadence follow-up due within {cadence}d window</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Milestones (tasks due)" count={milestones.length} emptyMsg="No tasks due in this window.">
        {milestones.length > 0 && (
          <table>
            <tbody>
              {milestones.map((t) => {
                const isOverdue = t.dueDate && new Date(t.dueDate).toISOString().slice(0, 10) < today;
                return (
                  <tr key={t.id}>
                    <td className="name-cell">
                      <span className={`pri-dot pri-${t.priority === "HIGH" ? "High" : t.priority === "LOW" ? "Low" : "Medium"}`} />
                      {t.title}
                    </td>
                    <td className="muted">{t.owner?.name || "—"}</td>
                    <td>
                      {isOverdue ? (
                        <span className="overdue-badge">{fmtDate(t.dueDate!)} (overdue)</span>
                      ) : t.dueDate ? (
                        fmtDate(t.dueDate)
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">{TASK_STATUS_LABELS[t.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Conferences & events" count={conferences.length} emptyMsg="No conferences or events in this window.">
        {conferences.length > 0 && (
          <table>
            <tbody>
              {conferences.map((ev) => (
                <tr key={ev.id}>
                  <td className="name-cell">{ev.name}</td>
                  <td className="muted">
                    {fmtDate(ev.startDate)}
                    {ev.endDate && new Date(ev.endDate).toISOString().slice(0, 10) !== new Date(ev.startDate).toISOString().slice(0, 10)
                      ? ` – ${fmtDate(ev.endDate)}`
                      : ""}
                  </td>
                  <td className="muted">{ev.location}</td>
                  <td>
                    <span className="tag">{EVENT_TYPE_LABELS[ev.type]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  emptyMsg,
  children,
}: {
  title: string;
  count: number;
  emptyMsg: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h3 style={{ fontSize: 14, margin: "22px 0 10px" }}>
        {title} <span className="muted" style={{ fontWeight: 400 }}>({count})</span>
      </h3>
      {count === 0 ? (
        <div className="empty">
          <h3>{emptyMsg}</h3>
        </div>
      ) : (
        children
      )}
    </>
  );
}
