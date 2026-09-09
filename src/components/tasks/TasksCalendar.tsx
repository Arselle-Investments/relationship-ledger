"use client";

import { useState } from "react";
import { TaskWithRelations } from "@/types/task";

function isoDate(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

function tasksOnDate(tasks: TaskWithRelations[], dateStr: string): TaskWithRelations[] {
  return tasks.filter((t) => t.dueDate && isoDate(t.dueDate) === dateStr);
}

function quarterStartMonth(m: number) {
  return Math.floor(m / 3) * 3;
}

function MonthGrid({
  year,
  month,
  tasks,
  onDayClick,
}: {
  year: number;
  month: number;
  tasks: TaskWithRelations[];
  onDayClick: (dateStr: string, dayTasks: TaskWithRelations[]) => void;
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
    const dayTasks = tasksOnDate(tasks, dateStr);
    const isToday = dateStr === today;
    const hasOverdue = dayTasks.some((t) => t.status !== "DONE" && dateStr < today);
    cells.push(
      <div
        key={dateStr}
        className={`cal-day ${dayTasks.length ? "has-conference" : ""} ${isToday ? "today" : ""} ${hasOverdue ? "overdue" : ""}`}
        onClick={dayTasks.length ? () => onDayClick(dateStr, dayTasks) : undefined}
      >
        <span>{d}</span>
        {dayTasks.length > 0 && (
          <div className="dots">
            {dayTasks.slice(0, 3).map((_, i) => (
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

export function TasksCalendar({
  tasks,
  onTaskClick,
}: {
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}) {
  const [span, setSpan] = useState<"quarter" | "year">("quarter");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dayModal, setDayModal] = useState<{ dateStr: string; tasks: TaskWithRelations[] } | null>(null);

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
            tasks={tasks}
            onDayClick={(dateStr, dayTasks) => setDayModal({ dateStr, tasks: dayTasks })}
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
              {dayModal.tasks.map((t) => (
                <div
                  key={t.id}
                  style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                  onClick={() => {
                    setDayModal(null);
                    onTaskClick(t);
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {t.title}
                    {t.status === "DONE" && <span className="tag forest" style={{ marginLeft: 6 }}>Done</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.assigneeLabel || t.owner?.name || "Unassigned"}
                    {t.contact ? ` · ${t.contact.name}` : ""}
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
