"use client";

import { useState } from "react";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-constants";
import { OverdueContact, StaleContact } from "@/lib/followups";
import { OverdueSequenceContact } from "@/lib/sequences";
import { ContactWithRelations } from "@/types/contact";

export function FollowupsClient({
  initialOverdue,
  initialStale,
  initialOverdueSequences,
  canEdit,
}: {
  initialOverdue: OverdueContact[];
  initialStale: StaleContact[];
  initialOverdueSequences: OverdueSequenceContact<ContactWithRelations>[];
  canEdit: boolean;
}) {
  const [overdue, setOverdue] = useState(initialOverdue);
  const [stale, setStale] = useState(initialStale);
  const [overdueSequences, setOverdueSequences] = useState(initialOverdueSequences);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      setStale((prev) => prev.filter((c) => c.id !== id));
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
        <div className="stat-card">
          <div className="num">{stale.length}</div>
          <div className="label">Data hygiene flags</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Sorted by most overdue first &middot; default cadence and per-contact overrides both apply
        </div>
        <div className="spacer" />
        <a className="btn" href="/api/followups/export">
          Export to Excel
        </a>
      </div>

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
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{CONTACT_STATUS_LABELS[c.status]}</td>
                <td>{c.owner?.name || <span className="muted">—</span>}</td>
                <td>
                  <span className="overdue-badge">{c.daysOverdue}d over (cadence {c.cadence}d)</span>
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

      <h3 style={{ marginBottom: 12 }}>Data hygiene flags</h3>
      {stale.length === 0 ? (
        <div className="empty">
          <h3>Nothing flagged</h3>
          <div>No stale or incomplete contacts.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Owner</th>
              <th>Why flagged</th>
            </tr>
          </thead>
          <tbody>
            {stale.map((c) => (
              <tr key={c.id}>
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{c.owner?.name || <span className="muted">—</span>}</td>
                <td>
                  {c.staleReasons.map((r) => (
                    <span key={r} className="tag rust">
                      {r}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
