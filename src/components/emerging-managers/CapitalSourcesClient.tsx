"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CapitalSource, ContactStatus, Consultant } from "@prisma/client";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-constants";

type CapitalSourceWithConsultant = CapitalSource & { consultant: Consultant | null };

type SortKey = "name" | "status" | "tier" | "timing" | "typicalCheckSize" | "arselleFit";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "tier", label: "Tier" },
  { key: "timing", label: "Timing" },
  { key: "typicalCheckSize", label: "Typical check size" },
  { key: "arselleFit", label: "Arselle fit" },
];

function sortValue(c: CapitalSourceWithConsultant, key: SortKey): string | number {
  switch (key) {
    case "name":
      return c.name.toLowerCase();
    case "status":
      return CONTACT_STATUS_LABELS[c.outreachStatus];
    case "tier":
      // untiered sinks to the bottom regardless of direction
      return c.tier ?? 99;
    case "timing":
      return (c.timing ?? "").toLowerCase();
    case "typicalCheckSize":
      return (c.typicalCheckSize ?? "").toLowerCase();
    case "arselleFit":
      return (c.arselleFit ?? "").toLowerCase();
  }
}

export function CapitalSourcesClient({
  initialCapitalSources,
  canEdit,
}: {
  initialCapitalSources: CapitalSourceWithConsultant[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [capitalSources, setCapitalSources] = useState(initialCapitalSources);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = capitalSources.filter((c) => {
      if (statusFilter && c.outreachStatus !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.shortName ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [capitalSources, search, statusFilter, sortKey, sortDir]);

  async function createCapitalSource() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/capital-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setCapitalSources((prev) => [...prev, { ...json.capitalSource, consultant: null }].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setAdding(false);
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Consultants and capital sources targeted for emerging-manager outreach, tracked separately from general
        contacts even where the same institution appears in both.
      </div>
      <div className="toolbar">
        <input type="text" placeholder="Search name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.values(ContactStatus).map((s) => (
            <option key={s} value={s}>
              {CONTACT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add capital source"}
          </button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alameda County Employees Retirement Association" />
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <button className="btn primary" onClick={createCapitalSource} disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {capitalSources.length} capital sources
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No capital sources found</h3>
          <div>Add one to start tracking outreach.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {SORT_COLUMNS.map(({ key, label }) => (
                  <th key={key} onClick={() => toggleSort(key)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                    {label}
                    {sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                <th>Consultant</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/capital-sources/${c.id}`)} style={{ cursor: "pointer" }}>
                  <td className="name-cell">
                    <Link
                      href={`/capital-sources/${c.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.name}
                      {c.shortName ? <span className="muted"> ({c.shortName})</span> : null}
                    </Link>
                  </td>
                  <td>
                    <span className="tag brass">{CONTACT_STATUS_LABELS[c.outreachStatus]}</span>
                  </td>
                  <td className="muted">{c.tier ? `Tier ${c.tier}` : "—"}</td>
                  <td className="muted">{c.timing || "—"}</td>
                  <td className="muted">{c.typicalCheckSize || "—"}</td>
                  <td className="muted" style={{ maxWidth: 320 }}>
                    {c.arselleFit ? (
                      <span title={c.arselleFit}>{c.arselleFit.length > 90 ? `${c.arselleFit.slice(0, 90)}…` : c.arselleFit}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="muted">
                    {c.consultant ? (
                      <Link
                        href={`/consultants/${c.consultant.id}`}
                        style={{ color: "inherit" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.consultant.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
