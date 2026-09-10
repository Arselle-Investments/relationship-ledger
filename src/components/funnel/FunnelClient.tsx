"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FundraisingStage, User } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { buildFunnelCounts, FUNDRAISING_STAGE_COLORS, fundraisingStageTextColor } from "@/lib/funnel";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";
import { BulkTaskModal } from "@/components/tasks/BulkTaskModal";

export function FunnelClient({
  contacts: initialContacts,
  team,
  canEdit,
}: {
  contacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const counts = useMemo(() => buildFunnelCounts(contacts), [contacts]);
  // NOT_STARTED is excluded from the scale and always drawn full — with it
  // included, its huge head-of-funnel count squashes every other stage into a
  // sliver. Every other bar still scales true-to-count against each other.
  const maxActive = Math.max(1, ...counts.filter((c) => c.status !== FundraisingStage.NOT_STARTED).map((c) => c.count));
  const [expanded, setExpanded] = useState<Set<FundraisingStage>>(new Set());
  const [creatingListFor, setCreatingListFor] = useState<FundraisingStage | null>(null);
  const [createdListFor, setCreatedListFor] = useState<Set<FundraisingStage>>(new Set());
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const [selectedByStage, setSelectedByStage] = useState<Map<FundraisingStage, Set<string>>>(new Map());
  const [bulkTaskStage, setBulkTaskStage] = useState<FundraisingStage | null>(null);
  const [bulkTaskMsg, setBulkTaskMsg] = useState<string | null>(null);
  const [stageSearch, setStageSearch] = useState("");
  const [lookupContact, setLookupContact] = useState<ContactWithRelations | null>(null);
  const stageRefs = useRef<Map<FundraisingStage, HTMLDivElement | null>>(new Map());

  const stageMatches = useMemo(() => {
    const q = stageSearch.trim().toLowerCase();
    if (!q) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [contacts, stageSearch]);

  function jumpToStage(status: FundraisingStage) {
    setExpanded((prev) => new Set(prev).add(status));
    requestAnimationFrame(() => {
      stageRefs.current.get(status)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const matchesByStage = useMemo(() => {
    const map = new Map<FundraisingStage, ContactWithRelations[]>();
    for (const status of expanded) {
      map.set(
        status,
        contacts.filter((c) => c.status === status).sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    return map;
  }, [contacts, expanded]);

  function toggleStage(status: FundraisingStage) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function selectedFor(status: FundraisingStage): Set<string> {
    return selectedByStage.get(status) ?? new Set();
  }

  function toggleContact(status: FundraisingStage, id: string) {
    setSelectedByStage((prev) => {
      const next = new Map(prev);
      const current = new Set<string>(next.get(status) ?? []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      next.set(status, current);
      return next;
    });
  }

  function toggleAllForStage(status: FundraisingStage, ids: string[]) {
    setSelectedByStage((prev) => {
      const next = new Map(prev);
      const current = next.get(status) ?? new Set();
      next.set(status, current.size === ids.length ? new Set() : new Set(ids));
      return next;
    });
  }

  function handleTasksCreated(status: FundraisingStage, count: number) {
    setBulkTaskStage(null);
    setSelectedByStage((prev) => {
      const next = new Map(prev);
      next.set(status, new Set());
      return next;
    });
    setBulkTaskMsg(`Created ${count} task${count === 1 ? "" : "s"}.`);
  }

  function handleContactSaved(contact: ContactWithRelations) {
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
    setEditingContact(null);
  }

  function handleContactDeleted(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setEditingContact(null);
  }

  async function createListForStage(status: FundraisingStage) {
    setCreatingListFor(status);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${FUNDRAISING_STAGE_LABELS[status]} (auto-refreshing)`,
        description: `Contacts currently in "${FUNDRAISING_STAGE_LABELS[status]}". Created from the Funnel view; refreshes automatically as stages change.`,
        mode: "DYNAMIC",
        filterStatus: status,
      }),
    });
    setCreatingListFor(null);
    if (res.ok) {
      setCreatedListFor((prev) => new Set(prev).add(status));
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a stage to see which contacts sit there
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Search a contact&apos;s funnel stage</div>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <input
            type="text"
            placeholder="Search a contact by name…"
            value={lookupContact ? lookupContact.name : stageSearch}
            onChange={(e) => {
              setStageSearch(e.target.value);
              setLookupContact(null);
            }}
          />
          {stageMatches.length > 0 && !lookupContact && (
            <div
              className="card"
              style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, marginTop: 4, padding: 4, maxHeight: 220, overflow: "auto" }}
            >
              {stageMatches.map((c) => (
                <div
                  key={c.id}
                  className="lookup-row"
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
                  onClick={() => {
                    setLookupContact(c);
                    setStageSearch("");
                  }}
                >
                  {c.name} {c.org ? <span className="muted">({c.org})</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {lookupContact && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 11px",
                borderRadius: 20,
                background: FUNDRAISING_STAGE_COLORS[lookupContact.status],
                color: fundraisingStageTextColor(lookupContact.status),
              }}
            >
              {FUNDRAISING_STAGE_LABELS[lookupContact.status]}
            </span>
            <button className="btn small" onClick={() => jumpToStage(lookupContact.status)}>
              Jump to this stage
            </button>
            <button
              className="btn small ghost"
              onClick={() => {
                setLookupContact(null);
                setStageSearch("");
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {bulkTaskMsg && <div className="helptext" style={{ marginBottom: 12 }}>{bulkTaskMsg}</div>}

      <div className="card" style={{ padding: 22 }}>
        {counts.map(({ status, count }) => {
          const widthPct =
            status === FundraisingStage.NOT_STARTED ? 100 : Math.max(4, Math.round((count / maxActive) * 100));
          const color = FUNDRAISING_STAGE_COLORS[status];
          const isOpen = expanded.has(status);
          const matches = matchesByStage.get(status) ?? [];
          const selected = selectedFor(status);
          return (
            <div
              key={status}
              ref={(el) => {
                stageRefs.current.set(status, el);
              }}
              style={{ marginBottom: 14 }}
            >
              <div
                onClick={() => toggleStage(status)}
                style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              >
                <div style={{ width: 170, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", flex: "none" }}>
                  {FUNDRAISING_STAGE_LABELS[status]}
                </div>
                <div style={{ flex: 1, background: "var(--paper)", borderRadius: 6, overflow: "hidden", height: 28 }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 6,
                      transition: "width .2s",
                    }}
                  />
                </div>
                <div style={{ width: 36, textAlign: "right", fontFamily: "'Poppins',sans-serif", fontWeight: 600, flex: "none" }}>
                  {count}
                </div>
              </div>

              {isOpen && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 16,
                    background: "var(--paper-raised)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                  }}
                >
                  {canEdit && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      {createdListFor.has(status) ? (
                        <div className="helptext" style={{ margin: 0 }}>
                          Created. <Link href="/lists">View in Mailing Lists</Link>. It&rsquo;ll stay current as
                          contacts move through this stage.
                        </div>
                      ) : (
                        <button
                          className="btn small"
                          onClick={() => createListForStage(status)}
                          disabled={creatingListFor === status}
                        >
                          {creatingListFor === status ? "Creating…" : "Create auto-refreshing mailing list from this stage"}
                        </button>
                      )}
                      {selected.size > 0 && (
                        <button className="btn small primary" onClick={() => setBulkTaskStage(status)}>
                          Create task for {selected.size} selected
                        </button>
                      )}
                    </div>
                  )}
                  {matches.length === 0 ? (
                    <div className="muted">No contacts in this stage.</div>
                  ) : (
                    <>
                      <div className="helptext" style={{ marginBottom: 8 }}>
                        Click a contact&rsquo;s name to see their details and correspondence
                        {canEdit ? "; check a box to select them for a bulk task." : "."}
                      </div>
                      <table>
                        <thead>
                          <tr>
                            {canEdit && (
                              <th>
                                <input
                                  type="checkbox"
                                  checked={selected.size > 0 && selected.size === matches.length}
                                  onChange={() =>
                                    toggleAllForStage(
                                      status,
                                      matches.map((c) => c.id)
                                    )
                                  }
                                  title="Select all"
                                />
                              </th>
                            )}
                            <th>Name</th>
                            <th>Organization</th>
                            <th>Owner</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matches.map((c) => (
                            <tr key={c.id}>
                              {canEdit && (
                                <td onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selected.has(c.id)}
                                    onChange={() => toggleContact(status, c.id)}
                                  />
                                </td>
                              )}
                              <td className="name-cell" onClick={() => setEditingContact(c)} style={{ cursor: "pointer" }}>
                                {c.name}
                              </td>
                              <td>{c.org || <span className="muted">—</span>}</td>
                              <td className="muted">{c.owner?.name || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingContact && (
        <ContactModal
          contact={editingContact}
          team={team}
          canEdit={canEdit}
          onClose={() => setEditingContact(null)}
          onSaved={handleContactSaved}
          onDeleted={handleContactDeleted}
        />
      )}

      {bulkTaskStage && (
        <BulkTaskModal
          contactIds={Array.from(selectedFor(bulkTaskStage))}
          contactCount={selectedFor(bulkTaskStage).size}
          team={team}
          onClose={() => setBulkTaskStage(null)}
          onCreated={(count) => handleTasksCreated(bulkTaskStage, count)}
        />
      )}
    </div>
  );
}
