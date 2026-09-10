"use client";

export type CompanyAdvancedFilters = {
  priorityQuarter: string;
  investmentStructure: string;
  investmentStrategy: string;
  tag: string;
  sizeMin: string;
  sizeMax: string;
  hasWebsite: boolean;
  hasAum: boolean;
  hasDealActivity: boolean;
};

export const EMPTY_COMPANY_ADVANCED_FILTERS: CompanyAdvancedFilters = {
  priorityQuarter: "",
  investmentStructure: "",
  investmentStrategy: "",
  tag: "",
  sizeMin: "",
  sizeMax: "",
  hasWebsite: false,
  hasAum: false,
  hasDealActivity: false,
};

export function countActiveCompanyFilters(f: CompanyAdvancedFilters): number {
  return Object.entries(f).filter(([, v]) => (typeof v === "boolean" ? v : v !== "")).length;
}

export function CompaniesFilterModal({
  filters,
  onChange,
  onClose,
  investmentStructures,
  investmentStrategies,
  tags,
  priorityQuarters,
}: {
  filters: CompanyAdvancedFilters;
  onChange: (next: CompanyAdvancedFilters) => void;
  onClose: () => void;
  investmentStructures: string[];
  investmentStrategies: string[];
  tags: string[];
  priorityQuarters: string[];
}) {
  function set<K extends keyof CompanyAdvancedFilters>(key: K, value: CompanyAdvancedFilters[K]) {
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
              <label>Investment structure</label>
              <select value={filters.investmentStructure} onChange={(e) => set("investmentStructure", e.target.value)}>
                <option value="">Any structure</option>
                {investmentStructures.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Investment strategy</label>
              <select value={filters.investmentStrategy} onChange={(e) => set("investmentStrategy", e.target.value)}>
                <option value="">Any strategy</option>
                {investmentStrategies.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
            <div className="field">
              <label>Priority quarter</label>
              <select value={filters.priorityQuarter} onChange={(e) => set("priorityQuarter", e.target.value)}>
                <option value="">Any quarter</option>
                {priorityQuarters.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Check size range ($mm)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" placeholder="Min" value={filters.sizeMin} onChange={(e) => set("sizeMin", e.target.value)} />
              <span className="muted">to</span>
              <input type="number" placeholder="Max" value={filters.sizeMax} onChange={(e) => set("sizeMax", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <div className="checkbox-list" style={{ maxHeight: "none" }}>
              <label>
                <input type="checkbox" checked={filters.hasWebsite} onChange={(e) => set("hasWebsite", e.target.checked)} />
                Has a website on file
              </label>
              <label>
                <input type="checkbox" checked={filters.hasAum} onChange={(e) => set("hasAum", e.target.checked)} />
                Has AUM on file
              </label>
              <label>
                <input type="checkbox" checked={filters.hasDealActivity} onChange={(e) => set("hasDealActivity", e.target.checked)} />
                Has deal activity (sent to, or feedback logged)
              </label>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={() => onChange(EMPTY_COMPANY_ADVANCED_FILTERS)}>
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
