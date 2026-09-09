"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Conference, Contact, Travel, User } from "@prisma/client";
import { TaskWithRelations } from "@/types/task";
import { ConferenceModal } from "@/components/conferences/ConferenceModal";
import { TaskModal } from "@/components/tasks/TaskModal";

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeClient({
  currentUserId,
  userName,
  currentUserName,
  isOnTaskTeam,
  tasks: initialTasks,
  travel: initialTravel,
  conferences: initialConferences,
  allConferences: initialAllConferences,
  team,
  contacts,
  canEdit,
}: {
  currentUserId: string;
  userName: string;
  currentUserName: string | null;
  isOnTaskTeam: boolean;
  tasks: TaskWithRelations[];
  travel: Travel[];
  conferences: Conference[];
  allConferences: Conference[];
  team: User[];
  contacts: Contact[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [conferences, setConferences] = useState(initialConferences);
  const [allConferences, setAllConferences] = useState(initialAllConferences);
  const [editingConference, setEditingConference] = useState<Conference | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const myConferenceCount = conferences.filter((c) => c.attendeeIds.includes(currentUserId)).length;

  const [travel, setTravel] = useState(initialTravel);
  const [addingTrip, setAddingTrip] = useState(false);
  const [tripCity, setTripCity] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [tripNotes, setTripNotes] = useState("");
  const [tripError, setTripError] = useState<string | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);

  function upsertConference(conference: Conference) {
    setConferences((prev) => {
      const exists = prev.some((c) => c.id === conference.id);
      return exists ? prev.map((c) => (c.id === conference.id ? conference : c)) : [...prev, conference];
    });
    setAllConferences((prev) => {
      const exists = prev.some((c) => c.id === conference.id);
      return exists ? prev.map((c) => (c.id === conference.id ? conference : c)) : [...prev, conference];
    });
    setEditingConference(null);
  }

  function removeConference(id: string) {
    setConferences((prev) => prev.filter((c) => c.id !== id));
    setAllConferences((prev) => prev.filter((c) => c.id !== id));
    setEditingConference(null);
  }

  function isMine(task: TaskWithRelations): boolean {
    if (task.ownerId === currentUserId) return true;
    if (task.assigneeLabel === "Team") return isOnTaskTeam;
    return !!(currentUserName && task.assigneeLabel?.includes(currentUserName));
  }

  function handleTaskSaved(task: TaskWithRelations) {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      if (exists) return prev.map((t) => (t.id === task.id ? task : t));
      return isMine(task) ? [...prev, task] : prev;
    });
    setAddingTask(false);
  }

  function handleTaskDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setAddingTask(false);
  }

  async function handleAddTrip() {
    setTripError(null);
    if (!tripCity.trim() || !tripStart) {
      setTripError("City and start date are required.");
      return;
    }
    setSavingTrip(true);
    const res = await fetch("/api/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: tripCity.trim(), startDate: tripStart, endDate: tripEnd || tripStart, notes: tripNotes }),
    });
    const json = await res.json();
    setSavingTrip(false);
    if (!res.ok) {
      setTripError(json.error ?? "Something went wrong.");
      return;
    }
    setTravel((prev) => [...prev, json.trip].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
    setTripCity("");
    setTripStart("");
    setTripEnd("");
    setTripNotes("");
    setAddingTrip(false);
  }

  const firstName = userName.trim().split(/\s+/)[0];
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksOut = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate && new Date(t.dueDate).toISOString().slice(0, 10) <= twoWeeksOut)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [tasks, twoWeeksOut]
  );
  const noDateTasks = useMemo(() => tasks.filter((t) => !t.dueDate), [tasks]);

  async function markDone(task: TaskWithRelations) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "DONE" } : t)));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    if (!res.ok) setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
  }

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>
        {greeting()}, {firstName}
      </h2>
      <div className="helptext" style={{ marginBottom: 24 }}>
        Here&rsquo;s what&rsquo;s on your plate — {fmtDate(today)} to {fmtDate(twoWeeksOut)}.
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div style={{ fontSize: 22, fontWeight: 700 }}>{upcomingTasks.length}</div>
          <div className="label">Tasks due in the next 2 weeks</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 22, fontWeight: 700 }}>{travel.length}</div>
          <div className="label">Upcoming trips</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 22, fontWeight: 700 }}>{myConferenceCount}</div>
          <div className="label">Conferences you&rsquo;re attending</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 28, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14 }}>Your tasks</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          {canEdit && (
            <button className="btn small" onClick={() => setAddingTask(true)}>
              Add task
            </button>
          )}
          <Link href="/tasks" className="settings-link" style={{ padding: 0, fontSize: 12 }}>
            Open Tasks board →
          </Link>
        </div>
      </div>
      {upcomingTasks.length === 0 && noDateTasks.length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>
          <h3>Nothing due soon</h3>
          <div>No tasks assigned to you are due in the next two weeks.</div>
        </div>
      ) : (
        <table style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Contact</th>
              <th>Due</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {[...upcomingTasks, ...noDateTasks].map((t) => {
              const isOverdue = t.dueDate && t.dueDate.toISOString().slice(0, 10) < today;
              return (
                <tr key={t.id}>
                  <td className="name-cell">
                    <span className={`pri-dot pri-${t.priority === "HIGH" ? "High" : t.priority === "LOW" ? "Low" : "Medium"}`} />
                    {t.title}
                  </td>
                  <td className="muted">{t.contact?.name || "—"}</td>
                  <td className={isOverdue ? "overdue-text" : "muted"}>{t.dueDate ? fmtDate(t.dueDate) : "—"}</td>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn small" onClick={() => markDone(t)}>
                        Mark done
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontSize: 14 }}>Your travel</h3>
            {canEdit && (
              <button className="btn small" onClick={() => setAddingTrip((v) => !v)}>
                {addingTrip ? "Cancel" : "Add trip"}
              </button>
            )}
          </div>
          {addingTrip && (
            <div className="card" style={{ padding: 12, marginBottom: 8 }}>
              <div className="field-row">
                <div className="field">
                  <label>City</label>
                  <input placeholder="e.g. Austin, TX" value={tripCity} onChange={(e) => setTripCity(e.target.value)} />
                </div>
                <div className="field">
                  <label>Notes (optional)</label>
                  <input value={tripNotes} onChange={(e) => setTripNotes(e.target.value)} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Start date</label>
                  <input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>End date</label>
                  <input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} />
                </div>
              </div>
              {tripError && <div className="error-text" style={{ marginBottom: 10 }}>{tripError}</div>}
              <button className="btn primary" onClick={handleAddTrip} disabled={savingTrip}>
                {savingTrip ? "Saving…" : "Save trip"}
              </button>
            </div>
          )}
          {travel.length === 0 ? (
            <div className="empty">
              <div>No upcoming trips on file.</div>
            </div>
          ) : (
            travel.map((t) => (
              <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.city}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                </div>
                {t.notes && <div style={{ fontSize: 12.5, marginTop: 4 }}>{t.notes}</div>}
              </div>
            ))
          )}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ fontSize: 14 }}>Upcoming conferences</h3>
            <Link href="/conferences" className="settings-link" style={{ padding: 0, fontSize: 12 }}>
              Open Conferences →
            </Link>
          </div>
          <div className="helptext" style={{ marginBottom: 10 }}>
            Click one to mark yourself (or anyone from Arselle) as attending.
          </div>
          {conferences.length === 0 ? (
            <div className="empty">
              <div>Nothing on the conference calendar yet.</div>
            </div>
          ) : (
            conferences.map((c) => {
              const attending = c.attendeeIds.includes(currentUserId);
              return (
                <div
                  key={c.id}
                  className="card"
                  style={{ padding: 12, marginBottom: 8, cursor: "pointer" }}
                  onClick={() => setEditingConference(c)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                    {attending && <span className="tag forest">You&rsquo;re attending</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                    {c.location ? ` · ${c.location}` : ""}
                    {c.attendeeIds.length > 0 ? ` · ${c.attendeeIds.length} attending` : ""}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingConference && (
        <ConferenceModal
          conference={editingConference}
          allConferences={allConferences}
          team={team}
          canEdit={canEdit}
          onClose={() => setEditingConference(null)}
          onSaved={upsertConference}
          onDeleted={removeConference}
          onCreatedNext={upsertConference}
        />
      )}

      {addingTask && (
        <TaskModal
          task={null}
          team={team}
          contacts={contacts}
          canEdit={canEdit}
          onClose={() => setAddingTask(false)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Jump to</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href="/lookahead">
            Upcoming
          </Link>
          <Link className="btn" href="/target-companies">
            Target Companies
          </Link>
          <Link className="btn" href="/tasks">
            Tasks
          </Link>
          <Link className="btn" href="/funnel">
            Funnel
          </Link>
        </div>
      </div>
    </div>
  );
}
