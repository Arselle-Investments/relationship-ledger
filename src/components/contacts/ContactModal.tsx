"use client";

import { useEffect, useState } from "react";
import { User, ContactType, ContactTier, ContactStatus } from "@prisma/client";
import {
  CONTACT_TYPE_LABELS,
  CONTACT_TIER_LABELS,
  CONTACT_STATUS_LABELS,
} from "@/lib/contact-constants";
import { TASK_STATUS_LABELS } from "@/lib/task-constants";
import { ContactFormValues, ContactWithRelations } from "@/types/contact";
import { TaskWithRelations } from "@/types/task";
import { ContactSequenceSection } from "./ContactSequenceSection";

const TYPE_OPTIONS = Object.values(ContactType);
const TIER_OPTIONS = Object.values(ContactTier);
const STATUS_OPTIONS = Object.values(ContactStatus);

function toFormValues(contact: ContactWithRelations | null): ContactFormValues {
  if (!contact) {
    return {
      name: "",
      org: "",
      type: ContactType.OTHER,
      tier: ContactTier.TIER_2,
      status: ContactStatus.NOT_STARTED,
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
  const isEdit = !!contact;

  function handleSequenceUpdated(updated: ContactWithRelations) {
    setLiveContact(updated);
    onLiveUpdate(updated);
  }

  useEffect(() => {
    if (!contact) return;
    fetch(`/api/tasks?contactId=${contact.id}`)
      .then((r) => r.json())
      .then((json) => setLinkedTasks(json.tasks ?? []))
      .catch(() => setLinkedTasks([]));
  }, [contact]);

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
    if (values.status !== ContactStatus.NOT_STARTED && statusChanged && !values.notes.trim()) {
      setError(`Add a quick note before marking this contact "${CONTACT_STATUS_LABELS[values.status]}" — what's the context?`);
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
    onSaved(json.contact);
  }

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(`Delete ${contact.name}? This can't be undone.`)) return;
    const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(contact.id);
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEdit ? "Edit contact" : "Add contact"}</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {!canEdit && (
            <div className="locked-msg" style={{ display: "block" }}>
              View-only — you can browse this record but not change it.
            </div>
          )}
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
              <select value={values.status} onChange={(e) => set("status", e.target.value as ContactStatus)} disabled={!canEdit}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {CONTACT_STATUS_LABELS[s]}
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
          {isEdit && linkedTasks !== null && linkedTasks.length > 0 && (
            <div className="activity-log">
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ink-soft)", marginBottom: 8 }}>
                Linked tasks
              </label>
              {linkedTasks.map((t) => (
                <div key={t.id} className="activity-item">
                  {t.title} — {TASK_STATUS_LABELS[t.status]}
                  {t.dueDate ? ` · due ${new Date(t.dueDate).toISOString().slice(0, 10)}` : ""}
                </div>
              ))}
            </div>
          )}
          {isEdit && liveContact && (
            <ContactSequenceSection contact={liveContact} canEdit={canEdit} onUpdated={handleSequenceUpdated} />
          )}
          {error && <div className="error-text">{error}</div>}
        </div>
        {canEdit && (
          <div className="modal-foot">
            {isEdit ? (
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            ) : (
              <span />
            )}
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
