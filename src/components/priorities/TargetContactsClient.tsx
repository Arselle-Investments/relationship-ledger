"use client";

import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ContactTier, User } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";
import { TierColumn } from "./TierColumn";
import { TierCard } from "./TierCard";

const TIERS = [ContactTier.TIER_1, ContactTier.TIER_2, ContactTier.TIER_3];

export function TargetContactsClient({
  contacts: initialContacts,
  team,
  canEdit,
}: {
  contacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"view" | "edit">("view");
  const canEditNow = canEdit && mode === "edit";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byTier = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.org ?? "").toLowerCase().includes(q))
      : contacts;
    const map = new Map<ContactTier, ContactWithRelations[]>();
    for (const t of TIERS) map.set(t, []);
    for (const c of filtered) map.get(c.tier)?.push(c);
    for (const t of TIERS) map.get(t)?.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [contacts, search]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const contactId = active.id as string;
    const newTier = over.id as ContactTier;
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || contact.tier === newTier) return;

    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, tier: newTier } : c)));
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier }),
    });
    if (!res.ok) {
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, tier: contact.tier } : c)));
    }
  }

  function handleContactSaved(contact: ContactWithRelations) {
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
    setEditingContact(null);
  }

  function handleContactDeleted(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setEditingContact(null);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="eyebrow" style={{ fontSize: 11.5 }}>
          {canEditNow ? "Drag a card to move it between tiers" : "View mode. Switch to Edit to drag cards between tiers"}
        </div>
        {canEdit && (
          <div className="view-toggle">
            <button className={mode === "view" ? "active" : ""} onClick={() => setMode("view")}>
              View
            </button>
            <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>
              Edit
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14 }}>Target investors by tier</h3>
        <input
          type="text"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
      </div>
      <div className="helptext" style={{ marginBottom: 10 }}>
        Fund-raise investor prospects, shown with their current funnel stage. Deal-side/LP contacts are handled
        under Deal Capital instead.
      </div>
      <DndContext id="target-contacts-board" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="tier-board">
          {TIERS.map((tier) => (
            <TierColumn key={tier} dropId={tier} tier={tier} count={byTier.get(tier)?.length ?? 0} itemLabel="contacts">
              {(byTier.get(tier) ?? []).map((c) => (
                <TierCard
                  key={c.id}
                  dragId={c.id}
                  canEdit={canEditNow}
                  title={c.name}
                  subtitle={c.org}
                  badge={FUNDRAISING_STAGE_LABELS[c.status]}
                  onClick={() => setEditingContact(c)}
                />
              ))}
            </TierColumn>
          ))}
        </div>
      </DndContext>

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
