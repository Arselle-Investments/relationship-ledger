"use client";

import { useState } from "react";
import { User } from "@prisma/client";
import { ContactWithRelations } from "@/types/contact";
import { MailingListWithContacts } from "@/types/mailing-list";
import { ListModal } from "./ListModal";

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
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <span className="tag brass">
                  {entry.contacts.length} contact{entry.contacts.length === 1 ? "" : "s"}
                </span>
                <a className="btn small" href={`/api/lists/${entry.list.id}/export`}>
                  Export
                </a>
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
