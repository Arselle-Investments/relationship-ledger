"use client";

import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Company, ContactTier, User } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { ContactModal } from "@/components/contacts/ContactModal";
import { TierColumn } from "./TierColumn";
import { TierCard } from "./TierCard";

const TIERS = [ContactTier.TIER_1, ContactTier.TIER_2, ContactTier.TIER_3];

export function PrioritiesClient({
  contacts: initialContacts,
  companies: initialCompanies,
  team,
  canEdit,
}: {
  contacts: ContactWithRelations[];
  companies: Company[];
  team: User[];
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [companies, setCompanies] = useState(initialCompanies);
  const [editingContact, setEditingContact] = useState<ContactWithRelations | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const companiesByTier = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const filtered = q
      ? companies.filter((c) => c.name.toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q))
      : companies;
    const map = new Map<ContactTier, Company[]>();
    for (const t of TIERS) map.set(t, []);
    for (const c of filtered) if (c.tier) map.get(c.tier)?.push(c);
    for (const t of TIERS) map.get(t)?.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [companies, companySearch]);

  const contactsByTier = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const filtered = q
      ? contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.org ?? "").toLowerCase().includes(q))
      : contacts;
    const map = new Map<ContactTier, ContactWithRelations[]>();
    for (const t of TIERS) map.set(t, []);
    for (const c of filtered) map.get(c.tier)?.push(c);
    for (const t of TIERS) map.get(t)?.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [contacts, contactSearch]);

  const untieredCompanyCount = companies.filter((c) => !c.tier).length;

  async function handleCompanyDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const companyId = active.id as string;
    const newTier = over.id as ContactTier;
    const company = companies.find((c) => c.id === companyId);
    if (!company || company.tier === newTier) return;

    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, tier: newTier } : c)));
    const res = await fetch(`/api/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier }),
    });
    if (!res.ok) {
      setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, tier: company.tier } : c)));
    }
  }

  async function handleContactDragEnd(event: DragEndEvent) {
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
          Drag a card to move it between tiers
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14 }}>Companies by tier</h3>
        <input
          type="text"
          placeholder="Search companies…"
          value={companySearch}
          onChange={(e) => setCompanySearch(e.target.value)}
          style={{ width: 220 }}
        />
      </div>
      {untieredCompanyCount > 0 && (
        <div className="helptext" style={{ marginBottom: 10 }}>
          {untieredCompanyCount} compan{untieredCompanyCount === 1 ? "y has" : "ies have"} no tier set yet and
          aren&rsquo;t shown here — set a tier from the Companies page to bring one onto this board.
        </div>
      )}
      <DndContext id="companies-tier-board" sensors={sensors} onDragEnd={handleCompanyDragEnd}>
        <div className="tier-board">
          {TIERS.map((tier) => (
            <TierColumn key={tier} dropId={tier} tier={tier} count={companiesByTier.get(tier)?.length ?? 0} itemLabel="companies">
              {(companiesByTier.get(tier) ?? []).map((c) => (
                <TierCard
                  key={c.id}
                  dragId={c.id}
                  canEdit={canEdit}
                  title={c.name}
                  subtitle={c.city}
                />
              ))}
            </TierColumn>
          ))}
        </div>
      </DndContext>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 8 }}>
        <h3 style={{ fontSize: 14 }}>Contacts by tier</h3>
        <input
          type="text"
          placeholder="Search contacts…"
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
          style={{ width: 220 }}
        />
      </div>
      <DndContext id="contacts-tier-board" sensors={sensors} onDragEnd={handleContactDragEnd}>
        <div className="tier-board">
          {TIERS.map((tier) => (
            <TierColumn key={tier} dropId={tier} tier={tier} count={contactsByTier.get(tier)?.length ?? 0} itemLabel="contacts">
              {(contactsByTier.get(tier) ?? []).map((c) => (
                <TierCard
                  key={c.id}
                  dragId={c.id}
                  canEdit={canEdit}
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
