"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Conference, Travel } from "@prisma/client";
import { TaskWithRelations } from "@/types/task";

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
  userName,
  tasks: initialTasks,
  travel,
  conferences,
  canEdit,
}: {
  userName: string;
  tasks: TaskWithRelations[];
  travel: Travel[];
  conferences: Conference[];
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
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
          <div style={{ fontSize: 22, fontWeight: 700 }}>{conferences.length}</div>
          <div className="label">Conferences you&rsquo;re attending</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 28, marginBottom: 10 }}>
        <h3 style={{ fontSize: 14 }}>Your tasks</h3>
        <Link href="/tasks" className="settings-link" style={{ padding: 0, fontSize: 12 }}>
          Open Tasks board →
        </Link>
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
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Your travel</h3>
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
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Conferences you&rsquo;re attending</h3>
          {conferences.length === 0 ? (
            <div className="empty">
              <div>Nothing on your conference calendar yet.</div>
            </div>
          ) : (
            conferences.map((c) => (
              <div key={c.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                  {c.location ? ` · ${c.location}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Jump to</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href="/lookahead">
            Look Ahead
          </Link>
          <Link className="btn" href="/priorities">
            Priorities
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
