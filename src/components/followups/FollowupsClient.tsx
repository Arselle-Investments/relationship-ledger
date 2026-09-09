"use client";

import { useState } from "react";
import Link from "next/link";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { OverdueContact } from "@/lib/followups";
import { OverdueSequenceContact } from "@/lib/sequences";
import { ContactWithRelations } from "@/types/contact";

export function FollowupsClient({
  initialOverdue,
  initialOverdueSequences,
  canEdit,
}: {
  initialOverdue: OverdueContact[];
  initialOverdueSequences: OverdueSequenceContact<ContactWithRelations>[];
  canEdit: boolean;
}) {
  const [overdue, setOverdue] = useState(initialOverdue);
  const [overdueSequences, setOverdueSequences] = useState(initialOverdueSequences);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Set<string>>(new Set());
  const [selectedSequence, setSelectedSequence] = useState<Set<string>>(new Set());
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);

  const totalSelected = selectedCadence.size + selectedSequence.size;

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function toggleAll(ids: string[], set: Set<string>, setter: (s: Set<string>) => void) {
    setter(set.size === ids.length ? new Set() : new Set(ids));
  }

  async function markFollowedUp(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastContact: new Date().toISOString().slice(0, 10) }),
    });
    setBusyId(null);
    if (res.ok) {
      setOverdue((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function markStepDone(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/contacts/${id}/sequence`, { method: "PATCH" });
    setBusyId(null);
    if (res.ok) {
      setOverdueSequences((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function createTasksForSelected() {
    if (totalSelected === 0) return;
    setCreatingTasks(true);
    setTaskMsg(null);
    const res = await fetch("/api/followups/create-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cadenceContactIds: Array.from(selectedCadence),
        sequenceContactIds: Array.from(selectedSequence),
      }),
    });
    setCreatingTasks(false);
    if (!res.ok) {
      setTaskMsg("Something went wrong creating tasks.");
      return;
    }
    const json = await res.json();
    setTaskMsg(
      json.created === 0
        ? "No new tasks created — the selected follow-ups already had one open."
        : `Created ${json.created} task${json.created === 1 ? "" : "s"}${json.skipped > 0 ? ` (${json.skipped} already had one open)` : ""}.`
    );
    setSelectedCadence(new Set());
    setSelectedSequence(new Set());
  }

  return (
    <div>
      <div className="stat-row">
        <div className="stat-card alert">
          <div className="num">{overdue.length}</div>
          <div className="label">Overdue for follow-up</div>
        </div>
        <div className="stat-card alert">
          <div className="num">{overdueSequences.length}</div>
          <div className="label">Overdue sequence steps</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Sorted by most overdue first &middot; default cadence and per-contact overrides both apply
        </div>
        <div className="spacer" />
        {canEdit && (
          <button className="btn" onClick={createTasksForSelected} disabled={totalSelected === 0 || creatingTasks}>
            {creatingTasks ? "Creating…" : `Create tasks for selected${totalSelected ? ` (${totalSelected})` : ""}`}
          </button>
        )}
        <a className="btn" href="/api/followups/export">
          Export to Excel
        </a>
      </div>

      {taskMsg && <div className="helptext" style={{ marginBottom: 16 }}>{taskMsg}</div>}

      <h3 style={{ marginBottom: 12 }}>Overdue by cadence</h3>
      {overdue.length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>
          <h3>Nothing overdue</h3>
          <div>Every active-outreach contact is within cadence.</div>
        </div>
      ) : (
        <table style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              {canEdit && (
                <th>
                  <input
                    type="checkbox"
                    checked={selectedCadence.size === overdue.length}
                    onChange={() => toggleAll(overdue.map((c) => c.id), selectedCadence, setSelectedCadence)}
                    title="Select all"
                  />
                </th>
              )}
              <th>Name</th>
              <th>Organization</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Days overdue</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {overdue.map((c) => (
              <tr key={c.id}>
                {canEdit && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedCadence.has(c.id)}
                      onChange={() => toggle(selectedCadence, setSelectedCadence, c.id)}
                    />
                  </td>
                )}
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{FUNDRAISING_STAGE_LABELS[c.status]}</td>
                <td>{c.owner?.name || <span className="muted">—</span>}</td>
                <td>
                  <span className="overdue-badge">
                    {Number.isFinite(c.daysOverdue) ? `${c.daysOverdue}d over (cadence ${c.cadence}d)` : `no contact on file (cadence ${c.cadence}d)`}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    <button
                      className="btn small"
                      disabled={busyId === c.id}
                      onClick={() => markFollowedUp(c.id)}
                    >
                      {busyId === c.id ? "Saving…" : "Mark followed up"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginBottom: 12 }}>Overdue sequence steps</h3>
      {overdueSequences.length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>
          <h3>Nothing overdue</h3>
          <div>No active sequence has a step past its due date.</div>
        </div>
      ) : (
        <table style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              {canEdit && (
                <th>
                  <input
                    type="checkbox"
                    checked={selectedSequence.size === overdueSequences.length}
                    onChange={() =>
                      toggleAll(overdueSequences.map((c) => c.id), selectedSequence, setSelectedSequence)
                    }
                    title="Select all"
                  />
                </th>
              )}
              <th>Name</th>
              <th>Organization</th>
              <th>Sequence step</th>
              <th>Due</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {overdueSequences.map((c) => (
              <tr key={c.id}>
                {canEdit && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedSequence.has(c.id)}
                      onChange={() => toggle(selectedSequence, setSelectedSequence, c.id)}
                    />
                  </td>
                )}
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{c.step.title}</td>
                <td>
                  <span className="overdue-badge">due {c.step.dueDate}</span>
                </td>
                {canEdit && (
                  <td>
                    <button className="btn small" disabled={busyId === c.id} onClick={() => markStepDone(c.id)}>
                      {busyId === c.id ? "Saving…" : "Mark step done"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="helptext" style={{ marginTop: 20 }}>
        Looking for missing/stale contact data? That moved to{" "}
        <Link href="/data-hygiene">Data Quality &rarr; Data Hygiene</Link>.
      </div>
    </div>
  );
}
