"use client";

import { ContactType, FundraisingStage } from "@prisma/client";
import { CONTACT_TYPE_LABELS, FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

export type AdvancedFilters = {
  type: string;
  status: string;
  warmPath: string;
  state: string;
  tag: string;
  emailTier: string;
  hasEmail: boolean;
  hasPhone: boolean;
  commitmentMin: string;
  commitmentMax: string;
};

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {
  type: "",
  status: "",
  warmPath: "",
  state: "",
  tag: "",
  emailTier: "",
  hasEmail: false,
  hasPhone: false,
  commitmentMin: "",
  commitmentMax: "",
};

export function countActiveAdvancedFilters(f: AdvancedFilters): number {
  return Object.entries(f).filter(([, v]) => (typeof v === "boolean" ? v : v !== "")).length;
}

export function ContactsFilterModal({
  filters,
  onChange,
  onClose,
  states,
  tags,
}: {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  onClose: () => void;
  states: string[];
  tags: string[];
}) {
  function set<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>All filters</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <div className="field">
              <label>General type</label>
              <select value={filters.type} onChange={(e) => set("type", e.target.value)}>
                <option value="">All general types</option>
                {Object.values(ContactType).map((t) => (
                  <option key={t} value={t}>
                    {CONTACT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
                <option value="">Any status</option>
                {Object.values(FundraisingStage).map((s) => (
                  <option key={s} value={s}>
                    {FUNDRAISING_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Warm path contains</label>
              <input
                value={filters.warmPath}
                onChange={(e) => set("warmPath", e.target.value)}
                placeholder="e.g. a name"
              />
            </div>
            <div className="field">
              <label>State</label>
              <select value={filters.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">Any state</option>
                {states.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tag</label>
              <select value={filters.tag} onChange={(e) => set("tag", e.target.value)}>
                <option value="">Any tag</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Email tracking tier (Agora)</label>
              <select value={filters.emailTier} onChange={(e) => set("emailTier", e.target.value)}>
                <option value="">Any tier</option>
                {[1, 2, 3, 4, 5].map((t) => (
                  <option key={t} value={t}>
                    Tier {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Commitment range ($mm est.)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.commitmentMin}
                  onChange={(e) => set("commitmentMin", e.target.value)}
                />
                <span className="muted">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.commitmentMax}
                  onChange={(e) => set("commitmentMax", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="field">
            <div className="checkbox-list" style={{ maxHeight: "none" }}>
              <label>
                <input type="checkbox" checked={filters.hasEmail} onChange={(e) => set("hasEmail", e.target.checked)} />
                Has an email on file
              </label>
              <label>
                <input type="checkbox" checked={filters.hasPhone} onChange={(e) => set("hasPhone", e.target.checked)} />
                Has a phone number on file
              </label>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => onChange(EMPTY_ADVANCED_FILTERS)}>
            Clear all
          </button>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
