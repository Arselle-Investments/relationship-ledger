"use client";

import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Company, ContactTier } from "@prisma/client";
import { TierColumn } from "./TierColumn";
import { TierCard } from "./TierCard";

const TIERS = [ContactTier.TIER_1, ContactTier.TIER_2, ContactTier.TIER_3];

export function TargetCompaniesClient({ companies: initialCompanies, canEdit }: { companies: Company[]; canEdit: boolean }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [search, setSearch] = useState("");
  // Defaults to "view" — a whole board of drag targets is an easy way to
  // bump something to the wrong tier by accident, so reprioritizing takes a
  // deliberate switch to Edit first.
  const [mode, setMode] = useState<"view" | "edit">("view");
  const canEditNow = canEdit && mode === "edit";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byTier = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? companies.filter((c) => c.name.toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q))
      : companies;
    const map = new Map<ContactTier, Company[]>();
    for (const t of TIERS) map.set(t, []);
    for (const c of filtered) if (c.tier) map.get(c.tier)?.push(c);
    for (const t of TIERS) map.get(t)?.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [companies, search]);

  const untieredCount = companies.filter((c) => !c.tier).length;

  async function handleDragEnd(event: DragEndEvent) {
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
        <h3 style={{ fontSize: 14 }}>Target companies by tier</h3>
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
      </div>
      <div className="helptext" style={{ marginBottom: 10 }}>
        Priority for the AREF I fund raise specifically. Deal-level capital sources live under Deal Capital;
        Emerging Managers allocators live under Emerging Managers.
        {untieredCount > 0 &&
          ` ${untieredCount} compan${untieredCount === 1 ? "y has" : "ies have"} no tier set yet and aren't shown here. Set a tier from the Companies page to bring one onto this board.`}
      </div>
      <DndContext id="target-companies-board" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="tier-board">
          {TIERS.map((tier) => (
            <TierColumn key={tier} dropId={tier} tier={tier} count={byTier.get(tier)?.length ?? 0} itemLabel="companies">
              {(byTier.get(tier) ?? []).map((c) => (
                <TierCard key={c.id} dragId={c.id} canEdit={canEditNow} title={c.name} subtitle={c.city} />
              ))}
            </TierColumn>
          ))}
        </div>
      </DndContext>
    </div>
  );
}
