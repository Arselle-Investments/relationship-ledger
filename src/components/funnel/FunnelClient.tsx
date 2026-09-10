"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FundraisingStage, User } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { buildFunnelCounts, FUNDRAISING_STAGE_COLORS } from "@/lib/funnel";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";

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
  const max = Math.max(1, ...counts.map((c) => c.count));
  const [selected, setSelected] = useState<FundraisingStage | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [createdListId, setCreatedListId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);

  const matches = useMemo(() => (selected ? contacts.filter((c) => c.status === selected) : []), [contacts, selected]);

  function handleContactSaved(contact: ContactWithRelations) {
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
    setEditingContact(null);
  }

  function handleContactDeleted(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setEditingContact(null);
  }

  async function createListForStage() {
    if (!selected) return;
    setCreatingList(true);
    setCreatedListId(null);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${FUNDRAISING_STAGE_LABELS[selected]} (auto-refreshing)`,
        description: `Contacts currently in "${FUNDRAISING_STAGE_LABELS[selected]}" — created from the Funnel view, refreshes automatically as stages change.`,
        mode: "DYNAMIC",
        filterStatus: selected,
      }),
    });
    setCreatingList(false);
    if (res.ok) {
      const json = await res.json();
      setCreatedListId(json.list.id);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          Click a stage to see which contacts sit there
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        {counts.map(({ status, count }) => {
          const widthPct = Math.max(4, Math.round((count / max) * 100));
          const color = FUNDRAISING_STAGE_COLORS[status];
          return (
            <div
              key={status}
              onClick={() => {
                setSelected(status);
                setCreatedListId(null);
              }}
              style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, cursor: "pointer" }}
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
          );
        })}
      </div>

      {selected && (
        <div className="overlay open" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{FUNDRAISING_STAGE_LABELS[selected]}</h2>
              <button className="close-x" onClick={() => setSelected(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {canEdit && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  {createdListId ? (
                    <div className="helptext" style={{ margin: 0 }}>
                      Created — <Link href="/lists">view in Mailing Lists</Link>. It&rsquo;ll stay current as contacts move
                      through this stage.
                    </div>
                  ) : (
                    <button className="btn small" onClick={createListForStage} disabled={creatingList}>
                      {creatingList ? "Creating…" : "Create auto-refreshing mailing list from this stage"}
                    </button>
                  )}
                </div>
              )}
              {matches.length === 0 ? (
                <div className="muted">No contacts in this stage.</div>
              ) : (
                <>
                <div className="helptext" style={{ marginBottom: 8 }}>Click a contact to see their details and correspondence.</div>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Organization</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((c) => (
                      <tr key={c.id} onClick={() => setEditingContact(c)}>
                        <td className="name-cell">{c.name}</td>
                        <td>{c.org || <span className="muted">—</span>}</td>
                        <td className="muted">{c.owner?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
