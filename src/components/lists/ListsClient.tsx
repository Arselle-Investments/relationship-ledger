"use client";

import { useState } from "react";
import { User } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS, FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { MailingListWithContacts } from "@/types/mailing-list";
import { ListModal } from "./ListModal";

function filterSummary(entry: MailingListWithContacts, team: User[]): string | null {
  const { list } = entry;
  if (list.mode !== "DYNAMIC") return null;
  const parts: string[] = [];
  if (list.filterStatus) parts.push(FUNDRAISING_STAGE_LABELS[list.filterStatus]);
  if (list.filterType) parts.push(CONTACT_TYPE_LABELS[list.filterType]);
  if (list.filterTier) parts.push(CONTACT_TIER_LABELS[list.filterTier]);
  if (list.filterOwnerId) {
    const owner = team.find((u) => u.id === list.filterOwnerId);
    parts.push(`Owner: ${owner?.name || owner?.email || "—"}`);
  }
  if (list.filterTag) parts.push(`Tag: ${list.filterTag}`);
  return parts.length > 0 ? parts.join(" · ") : "Any contact";
}

export function ListsClient({
  initialLists,
  allContacts,
  team,
  canEdit,
}: {
  initialLists: MailingListWithContacts[];
  allContacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
}) {
  const [lists, setLists] = useState(initialLists);
  const [editing, setEditing] = useState<MailingListWithContacts | null | "new">(null);

  function upsertLocal(entry: MailingListWithContacts) {
    setLists((prev) => {
      const exists = prev.some((e) => e.list.id === entry.list.id);
      return exists ? prev.map((e) => (e.list.id === entry.list.id ? entry : e)) : [...prev, entry];
    });
    setEditing(null);
  }

  function removeLocal(id: string) {
    setLists((prev) => prev.filter((e) => e.list.id !== id));
    setEditing(null);
  }

  async function duplicateList(entry: MailingListWithContacts) {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${entry.list.name} (copy)`,
        description: entry.list.description,
        mode: entry.list.mode,
        contactIds: entry.list.contactIds,
        filterType: entry.list.filterType,
        filterTier: entry.list.filterTier,
        filterOwnerId: entry.list.filterOwnerId,
        filterTag: entry.list.filterTag,
        filterStatus: entry.list.filterStatus,
      }),
    });
    const json = await res.json();
    if (!res.ok) return;
    // Same filter/contactIds as the original, so its current membership is a safe stand-in
    // for the copy's — the copy is fully independent from here, editing it never touches the original.
    const newEntry = { list: json.list, contacts: entry.contacts };
    upsertLocal(newEntry);
    setEditing(newEntry);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            Create list
          </button>
        )}
      </div>

      {lists.length === 0 ? (
        <div className="empty">
          <h3>No mailing lists yet</h3>
          <div>Create a list to group contacts for a fundraising push.</div>
        </div>
      ) : (
        lists.map((entry) => (
          <div key={entry.list.id} className="card" style={{ padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontSize: 16 }}>
                  {entry.list.name}{" "}
                  {entry.list.mode === "DYNAMIC" && <span className="tag forest">smart list</span>}
                </h3>
                {entry.list.description && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                    {entry.list.description}
                  </div>
                )}
                {filterSummary(entry, team) && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                    Filters: {filterSummary(entry, team)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <span className="tag brass">
                  {entry.contacts.length} contact{entry.contacts.length === 1 ? "" : "s"}
                </span>
                <a className="btn small" href={`/api/lists/${entry.list.id}/export`}>
                  Export
                </a>
                {canEdit && (
                  <button className="btn small" onClick={() => duplicateList(entry)}>
                    Duplicate
                  </button>
                )}
                {canEdit && (
                  <button className="btn small" onClick={() => setEditing(entry)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
            {entry.contacts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {entry.contacts.map((c) => (
                  <span key={c.id} className="tag">
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {editing !== null && (
        <ListModal
          entry={editing === "new" ? null : editing}
          allContacts={allContacts}
          team={team}
          onClose={() => setEditing(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
        />
      )}
    </div>
  );
}
