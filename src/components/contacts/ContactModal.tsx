"use client";

import { useEffect, useState } from "react";
import { User, ContactType, ContactTier, FundraisingStage } from "@prisma/client";
import {
  CONTACT_TYPE_LABELS,
  CONTACT_TIER_LABELS,
  FUNDRAISING_STAGE_LABELS,
} from "@/lib/contact-constants";
import { ContactFormValues, ContactWithRelations } from "@/types/contact";
import { TaskWithRelations } from "@/types/task";
import { formatAssignees } from "@/lib/task-constants";
import { ActivityTimeline } from "./ActivityTimeline";
import { ContactResearchSection } from "./ContactResearchSection";
import { ContactAgoraSection, isBlank } from "./ContactAgoraSection";
import { ViewField } from "./ViewField";
import { TaskModal } from "@/components/tasks/TaskModal";

const TYPE_OPTIONS = Object.values(ContactType);
const TIER_OPTIONS = Object.values(ContactTier);
const STATUS_OPTIONS = Object.values(FundraisingStage);

function toFormValues(contact: ContactWithRelations | null): ContactFormValues {
  if (!contact) {
    return {
      name: "",
      org: "",
      type: ContactType.OTHER,
      tier: ContactTier.TIER_2,
      status: FundraisingStage.NOT_STARTED,
      ownerId: "",
      warmPathId: "",
      email: "",
      phone: "",
      city: "",
      lastContact: new Date().toISOString().slice(0, 10),
      cadenceOverrideDays: "",
      priorityQuarter: "",
      tags: "",
      notes: "",
    };
  }
  return {
    name: contact.name,
    org: contact.org ?? "",
    type: contact.type,
    tier: contact.tier,
    status: contact.status,
    ownerId: contact.ownerId ?? "",
    warmPathId: contact.warmPathId ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    city: contact.city ?? "",
    lastContact: contact.lastContact ? new Date(contact.lastContact).toISOString().slice(0, 10) : "",
    cadenceOverrideDays: contact.cadenceOverrideDays?.toString() ?? "",
    priorityQuarter: contact.priorityQuarter ?? "",
    tags: (contact.tags ?? []).join(", "),
    notes: contact.notes ?? "",
  };
}

function EmailValue({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, non-secure context) — the
      // email is still right there to select by hand.
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span>{email}</span>
      <button type="button" className="btn small ghost" style={{ padding: "1px 8px", fontSize: 11 }} onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function TagBubbles({ tags }: { tags: string }) {
  const list = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {list.map((t, i) => (
        <span key={i} className="tag">
          {t}
        </span>
      ))}
    </div>
  );
}

export function ContactModal({
  contact,
  team,
  canEdit,
  onClose,
  onSaved,
  onDeleted,
  onLiveUpdate = () => {},
}: {
  contact: ContactWithRelations | null;
  team: User[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (contact: ContactWithRelations) => void;
  /** Fired for updates that shouldn't close the modal (e.g. sequence progress). */
  onLiveUpdate?: (contact: ContactWithRelations) => void;
  onDeleted: (id: string) => void;
}) {
  const [values, setValues] = useState<ContactFormValues>(() => toFormValues(contact));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<TaskWithRelations[] | null>(null);
  const [liveContact, setLiveContact] = useState<ContactWithRelations | null>(contact);
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const isEdit = !!contact;
  // Defaults to View for an existing record — most visits are "what does this
  // say," not "let me change something." A brand-new contact has nothing to
  // summarize, so it always opens straight into the full form; a view-only
  // role never gets a toggle since there's nothing they could switch to.
  const [mode, setMode] = useState<"view" | "edit">(isEdit ? "view" : "edit");
  const effectiveMode: "view" | "edit" = !canEdit ? "view" : !isEdit ? "edit" : mode;

  function handleSequenceUpdated(updated: ContactWithRelations) {
    setLiveContact(updated);
    onLiveUpdate(updated);
  }

  async function handleSuggestionConfirmed() {
    if (!contact) return;
    const res = await fetch(`/api/contacts/${contact.id}`);
    if (!res.ok) return;
    const json = await res.json();
    setLiveContact(json.contact);
    setValues(toFormValues(json.contact));
    onLiveUpdate(json.contact);
  }

  useEffect(() => {
    if (!contact) return;
    fetch(`/api/tasks?contactId=${contact.id}`)
      .then((r) => r.json())
      .then((json) => setLinkedTasks(json.tasks ?? []))
      .catch(() => setLinkedTasks([]));
  }, [contact]);

  function handleTaskCreated(task: TaskWithRelations) {
    setLinkedTasks((prev) => [task, ...(prev ?? [])]);
    setAddingTask(false);
  }

  function handleTaskUpdated(task: TaskWithRelations) {
    setLinkedTasks((prev) => (prev ?? []).map((t) => (t.id === task.id ? task : t)));
    setEditingTask(null);
  }

  function handleTaskDeleted(id: string) {
    setLinkedTasks((prev) => (prev ?? []).filter((t) => t.id !== id));
    setEditingTask(null);
  }

  function set<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    if (!values.name.trim()) {
      setError("Name is required.");
      return;
    }
    const statusChanged = !contact || contact.status !== values.status;
    if (values.status !== FundraisingStage.NOT_STARTED && statusChanged && !values.notes.trim()) {
      setError(`Add a quick note before marking this contact "${FUNDRAISING_STAGE_LABELS[values.status]}": what's the context?`);
      return;
    }

    setSaving(true);
    const payload = {
      name: values.name.trim(),
      org: values.org.trim() || null,
      type: values.type,
      tier: values.tier,
      status: values.status,
      ownerId: values.ownerId || null,
      warmPathId: values.warmPathId || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      city: values.city.trim() || null,
      lastContact: values.lastContact || null,
      cadenceOverrideDays: values.cadenceOverrideDays ? parseInt(values.cadenceOverrideDays, 10) : null,
      priorityQuarter: values.priorityQuarter.trim() || null,
      tags: values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: values.notes,
    };

    const res = await fetch(isEdit ? `/api/contacts/${contact!.id}` : "/api/contacts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setMode("view");
    onSaved(json.contact);
  }

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(`Delete ${contact.name}? This can't be undone.`)) return;
    const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(contact.id);
  }

  const owner = team.find((u) => u.id === values.ownerId);
  const warmPath = team.find((u) => u.id === values.warmPathId);
  const agoraRaw = (liveContact?.agoraRaw ?? contact?.agoraRaw) as unknown as Record<string, string> | null;
  const jobTitle = agoraRaw?.["JOB TITLE"];
  const hasJobTitle = jobTitle != null && !isBlank(jobTitle);

  return (
    <>
    <div className="overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? contact!.name : "Add contact"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {!canEdit && (
            <div className="locked-msg" style={{ display: "block" }}>
              View-only. You can browse this record but not change it.
            </div>
          )}
          {isEdit && canEdit && (
            <div className="view-toggle" style={{ display: "inline-flex", marginBottom: 16 }}>
              <button className={mode === "view" ? "active" : ""} onClick={() => setMode("view")}>
                View
              </button>
              <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>
                Edit
              </button>
            </div>
          )}

          {effectiveMode === "view" ? (
            <>
              {hasJobTitle && <ViewField label="Job title" value={jobTitle} />}
              {values.org && <ViewField label="Organization" value={values.org} />}
              <ViewField label="Type" value={CONTACT_TYPE_LABELS[values.type]} />
              <ViewField label="Tier" value={CONTACT_TIER_LABELS[values.tier]} />
              <ViewField label="Status" value={FUNDRAISING_STAGE_LABELS[values.status]} />
              {values.email && <ViewField label="Email" value={<EmailValue email={values.email} />} />}
              {values.phone && <ViewField label="Phone" value={values.phone} />}
              {values.city && <ViewField label="City / region" value={values.city} />}
              {owner && <ViewField label="Owner" value={owner.name || owner.email} />}
              {warmPath && <ViewField label="Warm path" value={warmPath.name || warmPath.email} />}
              {values.lastContact && <ViewField label="Last contact" value={values.lastContact} />}
              {values.cadenceOverrideDays && (
                <ViewField label="Cadence override" value={`${values.cadenceOverrideDays} days`} />
              )}
              {values.priorityQuarter && <ViewField label="Priority quarter" value={values.priorityQuarter} />}
              {values.tags && <ViewField label="Tags" value={<TagBubbles tags={values.tags} />} />}
              {values.notes && <ViewField label="Notes" value={values.notes} />}
            </>
          ) : (
            <>
              <div className="field">
                <label>Name</label>
                <input value={values.name} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Organization</label>
                  <input value={values.org} onChange={(e) => set("org", e.target.value)} disabled={!canEdit} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input value={values.email} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Type</label>
                  <select value={values.type} onChange={(e) => set("type", e.target.value as ContactType)} disabled={!canEdit}>
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {CONTACT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tier</label>
                  <select value={values.tier} onChange={(e) => set("tier", e.target.value as ContactTier)} disabled={!canEdit}>
                    {TIER_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {CONTACT_TIER_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Status</label>
                  <select value={values.status} onChange={(e) => set("status", e.target.value as FundraisingStage)} disabled={!canEdit}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {FUNDRAISING_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Owner</label>
                  <select value={values.ownerId} onChange={(e) => set("ownerId", e.target.value)} disabled={!canEdit}>
                    <option value="">— none —</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Warm path</label>
                  <select value={values.warmPathId} onChange={(e) => set("warmPathId", e.target.value)} disabled={!canEdit}>
                    <option value="">— none —</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>City / region</label>
                  <input value={values.city} onChange={(e) => set("city", e.target.value)} disabled={!canEdit} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Last contact</label>
                  <input
                    type="date"
                    value={values.lastContact}
                    onChange={(e) => set("lastContact", e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="field">
                  <label>Cadence override (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={values.cadenceOverrideDays}
                    onChange={(e) => set("cadenceOverrideDays", e.target.value)}
                    disabled={!canEdit}
                  />
                  <div className="helptext">Leave blank to use the team default.</div>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Priority quarter</label>
                  <input
                    placeholder="e.g. 2026-Q4"
                    value={values.priorityQuarter}
                    onChange={(e) => set("priorityQuarter", e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="field">
                  <label>Tags</label>
                  <input
                    placeholder="comma, separated"
                    value={values.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} disabled={!canEdit} />
              </div>
            </>
          )}

          {isEdit && linkedTasks !== null && linkedTasks.length > 0 && (
            <div className="activity-log" style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ink-soft)", marginBottom: 8 }}>
                Linked tasks
              </label>
              {linkedTasks.map((t) => {
                const isDone = t.status === "DONE";
                const isOverdue = !isDone && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
                // Done tasks skip the priority stripe/dot entirely — that
                // urgency no longer applies once the work is finished — and
                // fade as a whole to read as settled rather than needing eyes.
                const priorityClass = t.priority === "HIGH" ? "High" : t.priority === "LOW" ? "Low" : "Medium";
                return (
                  <div
                    key={t.id}
                    className={`task-card${isDone ? "" : ` pri-${priorityClass}`}`}
                    style={{ cursor: "pointer", opacity: isDone ? 0.55 : 1 }}
                    onClick={() => setEditingTask(t)}
                  >
                    <div className="t">
                      {t.title}
                      {isDone && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          Done
                        </span>
                      )}
                      {t.status === "IN_PROGRESS" && (
                        <span className="tag brass" style={{ marginLeft: 6 }}>
                          In progress
                        </span>
                      )}
                    </div>
                    <div className="meta">
                      <span>
                        {!isDone && <span className={`pri-dot pri-${priorityClass}`} />}
                        {formatAssignees(t.assigneeIds, team)}
                      </span>
                      <span className={isOverdue ? "overdue-text" : undefined}>
                        {t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {isEdit && contact && (
            <ActivityTimeline contactId={contact.id} canEdit={canEdit} onContactChanged={handleSuggestionConfirmed} />
          )}
          {isEdit && liveContact && (
            <ContactResearchSection contact={liveContact} canEdit={canEdit} onUpdated={handleSequenceUpdated} />
          )}
          {isEdit && liveContact && <ContactAgoraSection contact={liveContact} />}
          {error && <div className="error-text">{error}</div>}
        </div>
        {canEdit && (
          <div className="modal-foot">
            <div style={{ display: "flex", gap: 8 }}>
              {isEdit && (
                <button className="btn btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              )}
              {isEdit && (
                <button className="btn small ghost" onClick={() => setAddingTask(true)}>
                  + Add task
                </button>
              )}
            </div>
            {effectiveMode === "edit" && (
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {addingTask && contact && (
      <TaskModal
        task={null}
        team={team}
        contacts={liveContact ? [liveContact] : [contact]}
        canEdit={canEdit}
        defaultContactId={contact.id}
        onClose={() => setAddingTask(false)}
        onSaved={handleTaskCreated}
        onDeleted={() => setAddingTask(false)}
      />
    )}

    {editingTask && contact && (
      <TaskModal
        task={editingTask}
        team={team}
        contacts={liveContact ? [liveContact] : [contact]}
        canEdit={canEdit}
        onClose={() => setEditingTask(null)}
        onSaved={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    )}
    </>
  );
}
