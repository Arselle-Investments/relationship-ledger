"use client";

import { useMemo, useState } from "react";

type OrphanContact = { id: string; name: string; org: string | null; email: string | null; city: string | null; companyId: string | null };
type OrphanGroup = { org: string; contacts: OrphanContact[] };
type ExistingCompany = { id: string; name: string; city: string | null };

type Draft = {
  name: string;
  city: string;
  website: string;
  linkedinUrl: string;
  aum: string;
  founded: string;
};

function draftDefaults(group: OrphanGroup): Draft {
  return {
    name: group.org,
    city: group.contacts.find((c) => c.city)?.city ?? "",
    website: "",
    linkedinUrl: "",
    aum: "",
    founded: "",
  };
}

function GroupCard({
  group,
  canEdit,
  draft,
  onDraftChange,
  allCompanies,
  onCreated,
  onLinked,
  onDismissed,
}: {
  group: OrphanGroup;
  canEdit: boolean;
  draft: Draft;
  onDraftChange: (patch: Partial<Draft>) => void;
  allCompanies: ExistingCompany[];
  onCreated: () => void;
  onLinked: (companyName: string) => void;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [existingCompanyId, setExistingCompanyId] = useState("");

  const existingMatches = useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    const pool = q ? allCompanies.filter((c) => c.name.toLowerCase().includes(q)) : allCompanies;
    return pool.slice(0, 25);
  }, [allCompanies, existingSearch]);

  async function linkExisting() {
    if (!existingCompanyId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/companies/${existingCompanyId}/link-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: group.contacts.map((c) => c.id) }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onLinked(json.company.name as string);
  }

  async function research() {
    setResearching(true);
    setError(null);
    const res = await fetch("/api/companies/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name, city: draft.city || null }),
    });
    const json = await res.json().catch(() => ({}));
    setResearching(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn't research this company.");
      return;
    }
    const r = json.research;
    onDraftChange({
      website: r.website ?? draft.website,
      linkedinUrl: r.linkedinUrl ?? draft.linkedinUrl,
      aum: r.aum ?? draft.aum,
      founded: r.founded ?? draft.founded,
    });
    if (!r.website && !r.linkedinUrl && !r.aum && !r.founded) {
      setError("No confident public results found — fields left as-is.");
    }
  }

  async function createCompany() {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name.trim(),
        city: draft.city.trim() || null,
        website: draft.website.trim() || null,
        linkedinUrl: draft.linkedinUrl.trim() || null,
        aum: draft.aum.trim() || null,
        founded: draft.founded.trim() || null,
        linkContactIds: group.contacts.map((c) => c.id),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onCreated();
  }

  async function dismiss() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/companies/new-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org: group.org }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    onDismissed();
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{group.org}</div>
        <span className="tag forest">
          {group.contacts.length} contact{group.contacts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        {group.contacts.map((c) => c.name).join(", ")}
      </div>

      {!canEdit ? (
        <div className="helptext">View-only. An editor needs to resolve this.</div>
      ) : (
        <div>
          <div className="field-row">
            <div className="field">
              <label>Name</label>
              <input value={draft.name} onChange={(e) => onDraftChange({ name: e.target.value })} />
            </div>
            <div className="field">
              <label>City</label>
              <input value={draft.city} onChange={(e) => onDraftChange({ city: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <button type="button" className="btn small" onClick={research} disabled={researching}>
              {researching ? "Researching…" : "Research this company"}
            </button>
            <span className="helptext" style={{ marginLeft: 8 }}>
              Pulls website, LinkedIn, AUM, and founding year from public web search.
            </span>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Website</label>
              <input value={draft.website} onChange={(e) => onDraftChange({ website: e.target.value })} />
            </div>
            <div className="field">
              <label>LinkedIn</label>
              <input value={draft.linkedinUrl} onChange={(e) => onDraftChange({ linkedinUrl: e.target.value })} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>AUM</label>
              <input value={draft.aum} onChange={(e) => onDraftChange({ aum: e.target.value })} />
            </div>
            <div className="field">
              <label>Founded</label>
              <input value={draft.founded} onChange={(e) => onDraftChange({ founded: e.target.value })} />
            </div>
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn small primary" onClick={createCompany} disabled={busy}>
              {busy ? "Working…" : "Create company"}
            </button>
            <button
              className="btn small"
              onClick={() => {
                setLinking((v) => !v);
                setExistingCompanyId("");
              }}
            >
              {linking ? "Cancel linking" : "Link to existing instead"}
            </button>
            <button className="btn small btn-danger" onClick={dismiss} disabled={busy}>
              Not a company
            </button>
          </div>

          {linking && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--paper)", borderRadius: 8 }}>
              <input
                type="text"
                placeholder="Search existing companies…"
                value={existingSearch}
                onChange={(e) => setExistingSearch(e.target.value)}
                style={{ marginBottom: 8, width: "100%" }}
              />
              <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 10 }}>
                {existingMatches.length === 0 ? (
                  <div className="helptext" style={{ padding: 10 }}>
                    No companies match.
                  </div>
                ) : (
                  existingMatches.map((c) => (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        fontSize: 13,
                        cursor: "pointer",
                        background: existingCompanyId === c.id ? "var(--brass-bg)" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name={`link-company-${group.org}`}
                        checked={existingCompanyId === c.id}
                        onChange={() => setExistingCompanyId(c.id)}
                      />
                      {c.name}
                      {c.city && <span className="muted">&middot; {c.city}</span>}
                    </label>
                  ))
                )}
              </div>
              <button className="btn small primary" onClick={linkExisting} disabled={!existingCompanyId || busy}>
                {busy ? "Linking…" : "Link to selected"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NewCompaniesClient({
  initialGroups,
  allCompanies,
  canEdit,
}: {
  initialGroups: OrphanGroup[];
  allCompanies: ExistingCompany[];
  canEdit: boolean;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);

  function draftFor(group: OrphanGroup): Draft {
    return drafts[group.org] ?? draftDefaults(group);
  }

  function updateDraft(org: string, group: OrphanGroup, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [org]: { ...(prev[org] ?? draftDefaults(group)), ...patch } }));
  }

  function resolve(org: string, message: string) {
    setGroups((prev) => prev.filter((g) => g.org !== org));
    setCreatedMsg(message);
  }

  return (
    <div>
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="num">{groups.length}</div>
          <div className="label">Organizations with no company record</div>
        </div>
      </div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Organizations on file with no company record behind them yet
      </div>
      {createdMsg && <div className="helptext" style={{ marginBottom: 12 }}>{createdMsg}</div>}
      {groups.length === 0 ? (
        <div className="empty">
          <h3>Nothing to review</h3>
          <div>Every organization on file already has a company record, or nothing&rsquo;s waiting on a decision.</div>
        </div>
      ) : (
        groups.map((g) => (
          <GroupCard
            key={g.org}
            group={g}
            canEdit={canEdit}
            draft={draftFor(g)}
            onDraftChange={(patch) => updateDraft(g.org, g, patch)}
            allCompanies={allCompanies}
            onCreated={() => resolve(g.org, `Created "${draftFor(g).name}" and linked ${g.contacts.length} contact${g.contacts.length === 1 ? "" : "s"}.`)}
            onLinked={(companyName) => resolve(g.org, `Linked ${g.contacts.length} contact${g.contacts.length === 1 ? "" : "s"} to "${companyName}".`)}
            onDismissed={() => resolve(g.org, `"${g.org}" won't be suggested again.`)}
          />
        ))
      )}
    </div>
  );
}
