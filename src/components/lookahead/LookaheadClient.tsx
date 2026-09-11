"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Settings, Deal, Consultant, CapitalSource, Company, User, FundraisingStage } from "@prisma/client";
import { getOverdueContacts } from "@/lib/followups";
import { getOverdueSequenceContacts, getUpcomingSequenceItems } from "@/lib/sequences";
import { getUpcomingCadenceContacts, windowBounds } from "@/lib/lookahead";
import { conferenceOverlapsWindow, quarterBounds } from "@/lib/conferences";
import { CONFERENCE_TYPE_LABELS } from "@/lib/conference-constants";
import { DEAL_STATUS_LABELS } from "@/lib/deal-constants";
import { TASK_STATUS_LABELS, formatAssignees } from "@/lib/task-constants";
import { contactMatchesCity } from "@/lib/travel-match";
import { TravelWithUser } from "@/lib/travel";
import { ContactWithRelations } from "@/types/contact";
import { TaskWithRelations } from "@/types/task";
import { Conference as ConferenceModel } from "@prisma/client";

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The two stages where this list matters most — a contact deliberately being
// courted for the current raise, or already in the room on diligence — so
// they're worth the eye jumping straight to instead of getting lost among
// every other overdue/upcoming row.
const HIGHLIGHT_STAGES: FundraisingStage[] = [FundraisingStage.ACTIVE_PROSPECT, FundraisingStage.DUE_DILIGENCE];
function highlightRowStyle(status: FundraisingStage): React.CSSProperties | undefined {
  return HIGHLIGHT_STAGES.includes(status) ? { background: "var(--brass-bg)" } : undefined;
}

export function LookaheadClient({
  contacts,
  tasks,
  conferences,
  travel,
  settings,
  activeDeals,
  stalledConsultants,
  stalledCapitalSources,
  tier1Companies,
  team,
}: {
  contacts: ContactWithRelations[];
  tasks: TaskWithRelations[];
  team: User[];
  conferences: ConferenceModel[];
  travel: TravelWithUser[];
  settings: Settings;
  activeDeals: Deal[];
  stalledConsultants: Consultant[];
  stalledCapitalSources: CapitalSource[];
  tier1Companies: Company[];
}) {
  const [windowDays, setWindowDays] = useState<14 | 30 | "quarter">(14);

  const bounds = useMemo(
    () => (windowDays === "quarter" ? { start: new Date().toISOString().slice(0, 10), end: quarterBounds(0).end } : windowBounds(windowDays)),
    [windowDays]
  );
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
  // Grouped by the exact date they're due, with anything already overdue
  // collapsed into its own leading bucket — this is what "feeds into Look
  // Ahead by the date it corresponds to" actually means day to day: a
  // flat list sorted by date still makes you scan every row to find "what's
  // due Thursday," a day-by-day agenda doesn't.
  const milestonesByDay = useMemo(() => {
    const groups = new Map<string, TaskWithRelations[]>();
    for (const t of milestones) {
      const key = t.dueDate && new Date(t.dueDate).toISOString().slice(0, 10) < today ? "overdue" : new Date(t.dueDate!).toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    const dayKeys = Array.from(groups.keys())
      .filter((k) => k !== "overdue")
      .sort();
    return [...(groups.has("overdue") ? [["overdue", groups.get("overdue")!] as const] : []), ...dayKeys.map((k) => [k, groups.get(k)!] as const)];
  }, [milestones, today]);

  const upcomingConferences = useMemo(
    () =>
      conferences
        .filter((ev) => conferenceOverlapsWindow(ev, bounds))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [conferences, bounds]
  );
  const upcomingTravel = useMemo(
    () =>
      travel
        .filter((t) => conferenceOverlapsWindow(t, bounds))
        .map((t) => ({ ...t, matches: contacts.filter((c) => contactMatchesCity(c, t.city)) }))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [travel, contacts, bounds]
  );

  const windowLabel = windowDays === 14 ? "the next 2 weeks" : windowDays === 30 ? "the next 30 days" : "this quarter";

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
          <button className={windowDays === "quarter" ? "active" : ""} onClick={() => setWindowDays("quarter")}>
            This quarter
          </button>
        </div>
        <div className="spacer" />
        <a className="btn" href={`/api/lookahead/export?days=${windowDays}`}>
          Export to Excel
        </a>
      </div>

      <div className="eyebrow" style={{ marginBottom: 14 }}>
        At a glance for {windowLabel} &middot; {fmtDate(bounds.start)} to {fmtDate(bounds.end)}
      </div>

      <Section title="Required follow-ups (overdue now)" count={requiredCadence.length + requiredSeq.length} emptyMsg="Nothing overdue right now.">
        {requiredCadence.length + requiredSeq.length > 0 && (
          <table>
            <tbody>
              {requiredCadence.map((c) => (
                <tr key={`cad-${c.id}`} style={highlightRowStyle(c.status)}>
                  <td className="name-cell">{c.name}</td>
                  <td>{c.org || <span className="muted">—</span>}</td>
                  <td className="muted">{c.owner?.name || "—"}</td>
                  <td>
                    <span className="overdue-badge">
                      {Number.isFinite(c.daysOverdue) ? `${c.daysOverdue + c.cadence}d since contact, overdue on cadence` : "no contact on file, overdue on cadence"}
                    </span>
                  </td>
                </tr>
              ))}
              {requiredSeq.map((c) => (
                <tr key={`seq-${c.id}`} style={highlightRowStyle(c.status)}>
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
                <tr key={`seq-${r.id}`} style={highlightRowStyle(r.status)}>
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
                  <tr key={`cad-${c.id}`} style={highlightRowStyle(c.status)}>
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
        {milestonesByDay.map(([day, dayTasks]) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".03em",
                color: day === "overdue" ? "var(--rust)" : "var(--ink-soft)",
                marginBottom: 4,
              }}
            >
              {day === "overdue" ? "Overdue" : fmtDate(day)}
            </div>
            <table>
              <tbody>
                {dayTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="name-cell">
                      <span className={`pri-dot pri-${t.priority === "HIGH" ? "High" : t.priority === "LOW" ? "Low" : "Medium"}`} />
                      {t.title}
                    </td>
                    <td className="muted">{formatAssignees(t.assigneeIds, team)}</td>
                    <td className="muted">{t.contact?.name || "—"}</td>
                    <td className="muted">{TASK_STATUS_LABELS[t.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <Section title="Conferences" count={upcomingConferences.length} emptyMsg="No conferences in this window.">
        {upcomingConferences.length > 0 && (
          <table>
            <tbody>
              {upcomingConferences.map((ev) => (
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
                    <span className="tag">{CONFERENCE_TYPE_LABELS[ev.type]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Team travel" count={upcomingTravel.length} emptyMsg="No team travel in this window.">
        {upcomingTravel.length > 0 && (
          <table>
            <tbody>
              {upcomingTravel.map((t) => (
                <tr key={t.id}>
                  <td className="name-cell">{t.city}</td>
                  <td className="muted">
                    {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                  </td>
                  <td className="muted">{t.user.name || t.user.email}</td>
                  <td>
                    {t.matches.length > 0 ? (
                      <a className="btn small" href="/travel">
                        {t.matches.length} matching contact{t.matches.length === 1 ? "" : "s"}
                      </a>
                    ) : (
                      <span className="muted">No matching contacts</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Active deals" count={activeDeals.length} emptyMsg="No deals currently active or under contract.">
        {activeDeals.length > 0 && (
          <table>
            <tbody>
              {activeDeals.map((d) => (
                <tr key={d.id}>
                  <td className="name-cell">
                    <Link href={`/deals/${d.id}`}>{d.name}</Link>
                  </td>
                  <td className="muted">{d.assetClass || "—"}</td>
                  <td>
                    <span className="tag brass">{DEAL_STATUS_LABELS[d.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Emerging Managers needing follow-up"
        count={stalledConsultants.length + stalledCapitalSources.length}
        emptyMsg="No Emerging Managers outreach stalled at 'outreach sent' right now."
      >
        {stalledConsultants.length + stalledCapitalSources.length > 0 && (
          <table>
            <tbody>
              {stalledConsultants.map((c) => (
                <tr key={`consultant-${c.id}`}>
                  <td className="name-cell">
                    <Link href={`/consultants/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="muted">Consultant</td>
                  <td className="muted">{c.nextStep || "—"}</td>
                </tr>
              ))}
              {stalledCapitalSources.map((cs) => (
                <tr key={`capital-source-${cs.id}`}>
                  <td className="name-cell">
                    <Link href={`/capital-sources/${cs.id}`}>{cs.name}</Link>
                  </td>
                  <td className="muted">Capital source</td>
                  <td className="muted">{cs.nextStep || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Tier 1 companies" count={tier1Companies.length} emptyMsg="No companies are marked Tier 1 yet.">
        {tier1Companies.length > 0 && (
          <table>
            <tbody>
              {tier1Companies.map((c) => (
                <tr key={c.id}>
                  <td className="name-cell">{c.name}</td>
                  <td className="muted">{c.city || "—"}</td>
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
