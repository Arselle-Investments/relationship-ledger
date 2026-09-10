"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { OverdueContact } from "@/lib/followups";
import { ActiveSequenceEntry, buildActiveSequenceEntry } from "@/lib/sequences";
import { ContactWithRelations } from "@/types/contact";
import { SequenceTemplateClient } from "@/types/sequence-template";

type SequenceContact = ActiveSequenceEntry<ContactWithRelations>;

export function FollowupsClient({
  initialOverdue,
  initialActiveSequences,
  contacts,
  canEdit,
}: {
  initialOverdue: OverdueContact[];
  initialActiveSequences: SequenceContact[];
  contacts: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [overdue, setOverdue] = useState(initialOverdue);
  const [activeSequences, setActiveSequences] = useState(initialActiveSequences);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Set<string>>(new Set());
  const [selectedSequence, setSelectedSequence] = useState<Set<string>>(new Set());
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskMsg, setTaskMsg] = useState<string | null>(null);

  const [templates, setTemplates] = useState<SequenceTemplateClient[] | null>(null);
  const [startContactId, setStartContactId] = useState("");
  const [startTemplateId, setStartTemplateId] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const overdueSequenceIds = activeSequences.filter((s) => s.overdue).map((s) => s.id);
  const totalSelected = selectedCadence.size + selectedSequence.size;
  const availableContacts = contacts.filter((c) => !activeSequences.some((s) => s.id === c.id));

  useEffect(() => {
    fetch("/api/sequence-templates")
      .then((r) => r.json())
      .then((json) => {
        setTemplates(json.templates ?? []);
        if (json.templates?.[0]) setStartTemplateId(json.templates[0].id);
      });
  }, []);

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
    if (!res.ok) return;
    const json = await res.json();
    const entry = buildActiveSequenceEntry(json.contact as ContactWithRelations);
    setActiveSequences((prev) => (entry ? prev.map((s) => (s.id === id ? entry : s)) : prev.filter((s) => s.id !== id)));
    setSelectedSequence((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function cancelSequence(id: string, name: string) {
    if (!confirm(`Cancel this outreach sequence for ${name}?`)) return;
    setBusyId(id);
    const res = await fetch(`/api/contacts/${id}/sequence`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      setActiveSequences((prev) => prev.filter((s) => s.id !== id));
      setSelectedSequence((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function startSequence() {
    if (!startContactId || !startTemplateId) return;
    setStarting(true);
    setStartError(null);
    const res = await fetch(`/api/contacts/${startContactId}/sequence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: startTemplateId }),
    });
    const json = await res.json();
    setStarting(false);
    if (!res.ok) {
      setStartError(json.error ?? "Something went wrong.");
      return;
    }
    const entry = buildActiveSequenceEntry(json.contact as ContactWithRelations);
    if (entry) setActiveSequences((prev) => [entry, ...prev]);
    setStartContactId("");
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
        ? "No new tasks created. The selected follow-ups already had one open."
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
          <div className="num">{overdueSequenceIds.length}</div>
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

      <h3 style={{ marginBottom: 4 }}>Outreach sequences</h3>
      <div className="helptext" style={{ marginBottom: 12 }}>
        Preset multi-step outreach cadences (e.g. &ldquo;Standard cold outreach&rdquo;) started on a contact and
        tracked here until every step is done or it&rsquo;s cancelled. Manage templates in{" "}
        <Link href="/settings">Settings</Link>.
      </div>

      {canEdit && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 10 }}>
            Start a sequence
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={startContactId} onChange={(e) => setStartContactId(e.target.value)} style={{ flex: "1 1 220px" }}>
              <option value="">— choose a contact —</option>
              {availableContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {templates === null ? (
              <div className="muted" style={{ fontSize: 12.5 }}>
                Loading templates…
              </div>
            ) : templates.length === 0 ? (
              <div className="muted" style={{ fontSize: 12.5 }}>
                No sequence templates yet. Add one in Settings.
              </div>
            ) : (
              <select value={startTemplateId} onChange={(e) => setStartTemplateId(e.target.value)} style={{ flex: "1 1 220px" }}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.steps.length} steps)
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn primary"
              onClick={startSequence}
              disabled={!startContactId || !startTemplateId || starting}
            >
              {starting ? "Starting…" : "Start sequence"}
            </button>
          </div>
          {startError && <div className="error-text" style={{ marginTop: 8 }}>{startError}</div>}
        </div>
      )}

      {activeSequences.length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>
          <h3>No active sequences</h3>
          <div>Start one above, or from Data Quality once a contact needs a structured outreach cadence.</div>
        </div>
      ) : (
        <table style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              {canEdit && (
                <th>
                  <input
                    type="checkbox"
                    checked={overdueSequenceIds.length > 0 && selectedSequence.size === overdueSequenceIds.length}
                    onChange={() => toggleAll(overdueSequenceIds, selectedSequence, setSelectedSequence)}
                    title="Select all overdue"
                  />
                </th>
              )}
              <th>Name</th>
              <th>Organization</th>
              <th>Template</th>
              <th>Next step</th>
              <th>Due</th>
              <th>Progress</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {activeSequences.map((c) => (
              <tr key={c.id}>
                {canEdit && (
                  <td onClick={(e) => e.stopPropagation()}>
                    {c.overdue && (
                      <input
                        type="checkbox"
                        checked={selectedSequence.has(c.id)}
                        onChange={() => toggle(selectedSequence, setSelectedSequence, c.id)}
                      />
                    )}
                  </td>
                )}
                <td className="name-cell">{c.name}</td>
                <td>{c.org || <span className="muted">—</span>}</td>
                <td>{c.templateName}</td>
                <td>{c.step.title}</td>
                <td>
                  {c.overdue ? (
                    <span className="overdue-badge">due {c.step.dueDate}</span>
                  ) : (
                    <span className="muted">due {c.step.dueDate}</span>
                  )}
                </td>
                <td className="muted">
                  {c.progress.done}/{c.progress.total} steps
                </td>
                {canEdit && (
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn small" disabled={busyId === c.id} onClick={() => markStepDone(c.id)}>
                      {busyId === c.id ? "Saving…" : "Mark step done"}
                    </button>
                    <button
                      className="btn small btn-danger"
                      disabled={busyId === c.id}
                      onClick={() => cancelSequence(c.id, c.name)}
                    >
                      Cancel
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
