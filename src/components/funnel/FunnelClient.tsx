"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ContactType, FundraisingStage, User } from "@prisma/client";
import { CONTACT_TYPE_LABELS, mergeStageLabels } from "@/lib/contact-constants";
import { buildFunnelCounts, PIPELINE_STAGES, DROPPED_STAGES, FUNDRAISING_STAGE_COLORS, fundraisingStageTextColor } from "@/lib/funnel";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";
import { BulkTaskModal } from "@/components/tasks/BulkTaskModal";
import { ProbabilityBars } from "@/components/ProbabilityBars";

// Several original tracker statuses (Second Close Prospect, Longer-Term
// Active, Strategic Target, etc.) all collapse into the single Active
// prospect stage — this pulls the original label back out of its preserved
// tag so that finer-grained categorization isn't lost when a stage is
// expanded here.
const AREF_STATUS_TAG_PREFIX = "AREF I Status: ";
function arefSubcategory(tags: string[]): string | null {
  const tag = tags.find((t) => t.startsWith(AREF_STATUS_TAG_PREFIX));
  return tag ? tag.slice(AREF_STATUS_TAG_PREFIX.length) : null;
}

type StageSortKey = "name" | "category" | "probability" | "org" | "type";

export function FunnelClient({
  contacts: initialContacts,
  team,
  canEdit,
  stageLabelOverrides,
}: {
  contacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
  stageLabelOverrides?: Partial<Record<FundraisingStage, string>> | null;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const labels = useMemo(() => mergeStageLabels(stageLabelOverrides), [stageLabelOverrides]);
  const [typeFilter, setTypeFilter] = useState<ContactType | "ALL">("ALL");
  const filteredContacts = useMemo(
    () => (typeFilter === "ALL" ? contacts : contacts.filter((c) => c.type === typeFilter)),
    [contacts, typeFilter]
  );
  const pipelineCounts = useMemo(() => buildFunnelCounts(filteredContacts, PIPELINE_STAGES), [filteredContacts]);
  const droppedCounts = useMemo(() => buildFunnelCounts(filteredContacts, DROPPED_STAGES), [filteredContacts]);
  const counts = useMemo(() => [...pipelineCounts, ...droppedCounts], [pipelineCounts, droppedCounts]);
  // NOT_STARTED is excluded from the scale and always drawn full — with it
  // included, its huge head-of-funnel count squashes every other stage into a
  // sliver. Every other bar still scales true-to-count against each other.
  // The two boxes share one scale so a bar's width still means the same thing
  // whichever box it's in.
  const maxActive = Math.max(1, ...counts.filter((c) => c.status !== FundraisingStage.NOT_STARTED).map((c) => c.count));
  const [expanded, setExpanded] = useState<Set<FundraisingStage>>(new Set());
  const [creatingListFor, setCreatingListFor] = useState<FundraisingStage | null>(null);
  const [createdListFor, setCreatedListFor] = useState<Set<FundraisingStage>>(new Set());
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const [selectedByStage, setSelectedByStage] = useState<Map<FundraisingStage, Set<string>>>(new Map());
  const [bulkTaskStage, setBulkTaskStage] = useState<FundraisingStage | null>(null);
  const [bulkTaskMsg, setBulkTaskMsg] = useState<string | null>(null);
  const [bulkMoveTarget, setBulkMoveTarget] = useState<Record<string, FundraisingStage | "">>({});
  const [bulkMoveNote, setBulkMoveNote] = useState<Record<string, string>>({});
  const [bulkMoveProbability, setBulkMoveProbability] = useState<Record<string, number | null>>({});
  const [bulkMoveBusy, setBulkMoveBusy] = useState<FundraisingStage | null>(null);
  const [bulkMoveError, setBulkMoveError] = useState<string | null>(null);
  const [sortByStage, setSortByStage] = useState<Record<string, StageSortKey>>({});
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
      const sortKey = sortByStage[status] ?? "name";
      const rows = filteredContacts.filter((c) => c.status === status);
      rows.sort((a, b) => {
        if (sortKey === "probability") {
          const diff = (b.closeProbability ?? 0) - (a.closeProbability ?? 0);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        if (sortKey === "category") {
          const ac = arefSubcategory(a.tags) ?? "";
          const bc = arefSubcategory(b.tags) ?? "";
          return ac === bc ? a.name.localeCompare(b.name) : ac.localeCompare(bc);
        }
        if (sortKey === "org") {
          const ao = a.org ?? "";
          const bo = b.org ?? "";
          return ao === bo ? a.name.localeCompare(b.name) : ao.localeCompare(bo);
        }
        if (sortKey === "type") {
          const at = a.agoraType ?? "";
          const bt = b.agoraType ?? "";
          return at === bt ? a.name.localeCompare(b.name) : at.localeCompare(bt);
        }
        return a.name.localeCompare(b.name);
      });
      map.set(status, rows);
    }
    return map;
  }, [contacts, expanded, sortByStage]);

  async function updateProbability(contactId: string, next: number | null) {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, closeProbability: next } : c)));
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closeProbability: next }),
    });
  }

  async function moveSelectedToStage(status: FundraisingStage) {
    const target = bulkMoveTarget[status];
    if (!target) return;
    setBulkMoveError(null);
    setBulkMoveBusy(status);
    const probability = bulkMoveProbability[status];
    const res = await fetch("/api/contacts/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactIds: Array.from(selectedFor(status)),
        status: target,
        note: bulkMoveNote[status] ?? "",
        ...(target === FundraisingStage.ACTIVE_PROSPECT && probability ? { closeProbability: probability } : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBulkMoveBusy(null);
    if (!res.ok) {
      setBulkMoveError(json.error ?? "Something went wrong.");
      return;
    }
    setContacts((prev) =>
      prev.map((c) =>
        selectedFor(status).has(c.id)
          ? { ...c, status: target, closeProbability: probability ?? c.closeProbability }
          : c
      )
    );
    setSelectedByStage((prev) => {
      const next = new Map(prev);
      next.set(status, new Set());
      return next;
    });
    setBulkMoveTarget((prev) => ({ ...prev, [status]: "" }));
    setBulkMoveNote((prev) => ({ ...prev, [status]: "" }));
    setBulkMoveProbability((prev) => ({ ...prev, [status]: null }));
    setBulkTaskMsg(`Moved ${json.moved} contact${json.moved === 1 ? "" : "s"} to ${labels[target]}.`);
  }

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
        name: `${labels[status]} (auto-refreshing)`,
        description: `Contacts currently in "${labels[status]}". Created from the Funnel view; refreshes automatically as stages change.`,
        mode: "DYNAMIC",
        filterStatus: status,
      }),
    });
    setCreatingListFor(null);
    if (res.ok) {
      setCreatedListFor((prev) => new Set(prev).add(status));
    }
  }

  function renderStageBar(status: FundraisingStage, count: number) {
    const widthPct = status === FundraisingStage.NOT_STARTED ? 100 : Math.max(4, Math.round((count / maxActive) * 100));
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
            {labels[status]}
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
                {selected.size > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={bulkMoveTarget[status] ?? ""}
                      onChange={(e) =>
                        setBulkMoveTarget((prev) => ({ ...prev, [status]: e.target.value as FundraisingStage }))
                      }
                      style={{ fontSize: 12.5 }}
                    >
                      <option value="">Move {selected.size} to…</option>
                      {Object.values(FundraisingStage)
                        .filter((s) => s !== status)
                        .map((s) => (
                          <option key={s} value={s}>
                            {labels[s]}
                          </option>
                        ))}
                    </select>
                    {bulkMoveTarget[status] && bulkMoveTarget[status] !== FundraisingStage.NOT_STARTED && (
                      <input
                        type="text"
                        placeholder="Note (required)"
                        value={bulkMoveNote[status] ?? ""}
                        onChange={(e) => setBulkMoveNote((prev) => ({ ...prev, [status]: e.target.value }))}
                        style={{ fontSize: 12.5, width: 160 }}
                      />
                    )}
                    {bulkMoveTarget[status] === FundraisingStage.ACTIVE_PROSPECT && (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        Probability
                        <ProbabilityBars
                          value={bulkMoveProbability[status] ?? null}
                          canEdit
                          onChange={(next) => setBulkMoveProbability((prev) => ({ ...prev, [status]: next }))}
                          size="sm"
                        />
                      </label>
                    )}
                    <button
                      className="btn small"
                      onClick={() => moveSelectedToStage(status)}
                      disabled={!bulkMoveTarget[status] || bulkMoveBusy === status}
                    >
                      {bulkMoveBusy === status ? "Moving…" : "Move"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {bulkMoveError && <div className="error-text" style={{ marginBottom: 10 }}>{bulkMoveError}</div>}
            {matches.length === 0 ? (
              <div className="muted">No contacts in this stage.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <div className="helptext" style={{ margin: 0 }}>
                    Click a contact&rsquo;s name to see their details and correspondence
                    {canEdit ? "; check a box to select them for a bulk action." : "."}
                  </div>
                  <div className="spacer" />
                  <label style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
                    Sort by
                    <select
                      value={sortByStage[status] ?? "name"}
                      onChange={(e) =>
                        setSortByStage((prev) => ({ ...prev, [status]: e.target.value as StageSortKey }))
                      }
                      style={{ fontSize: 12.5 }}
                    >
                      <option value="name">Name</option>
                      <option value="category">Category</option>
                      <option value="org">Organization</option>
                      <option value="type">Contact Type</option>
                      <option value="probability">Probability</option>
                    </select>
                  </label>
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
                      <th>Contact Type</th>
                      <th>Category</th>
                      <th>Probability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((c) => {
                      const subcategory = arefSubcategory(c.tags);
                      return (
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
                          <td className="muted">{c.agoraType || "—"}</td>
                          <td>
                            {subcategory ? (
                              <span className="tag">{subcategory}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            <ProbabilityBars
                              value={c.closeProbability}
                              canEdit={canEdit}
                              onChange={(next) => updateProbability(c.id, next)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a stage to see which contacts sit there
        </div>
        <div className="spacer" />
        <label style={{ fontSize: 12.5, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
          Filter by general type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ContactType | "ALL")}>
            <option value="ALL">All general types</option>
            {Object.values(ContactType).map((t) => (
              <option key={t} value={t}>
                {CONTACT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
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
              {labels[lookupContact.status]}
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

      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        {pipelineCounts.map(({ status, count }) => renderStageBar(status, count))}
      </div>

      <div className="eyebrow" style={{ fontSize: 11.5, marginBottom: 8 }}>
        Fund II prospects &amp; drop-offs
      </div>
      <div className="card" style={{ padding: 22 }}>
        {droppedCounts.map(({ status, count }) => renderStageBar(status, count))}
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
