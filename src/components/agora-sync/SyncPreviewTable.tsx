"use client";

import { useEffect, useMemo, useState } from "react";
import { FundraisingStage, RecordContext } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { RECORD_CONTEXT_LABELS } from "@/lib/record-context";

export type PreviewKind = "new" | "changed" | "all";

type PreviewRow = {
  id: string;
  name: string;
  email: string | null;
  org: string | null;
  status: FundraisingStage;
  recordContexts: RecordContext[];
  doNotContact: boolean;
  updatedAt: string;
  lastSent: string | null;
  heldBack: boolean;
};

const KIND_TITLES: Record<PreviewKind, string> = {
  new: "New contacts — never sent to Agora",
  changed: "Changed contacts — edited since they were last sent",
  all: "Full database — every contact with a real email",
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export function SyncPreviewTable({ kind, onClose }: { kind: PreviewKind; onClose: () => void }) {
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    fetch(`/api/agora-sync/preview?kind=${kind}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(json.error ?? "Couldn't load the preview.");
        else setRows(json.rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the preview.");
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.email ?? ""} ${r.org ?? ""}`.toLowerCase().includes(q));
  }, [rows, filter]);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{KIND_TITLES[kind]}</div>
        <button className="btn small ghost" onClick={onClose}>
          Hide
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}
      {!rows && !error && <div className="helptext">Loading…</div>}
      {rows && (
        <>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Filter by name, email, or organization…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="muted" style={{ fontSize: 12.5 }}>
              {visible.length === rows.length ? `${rows.length} contacts` : `${visible.length} of ${rows.length}`}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="empty">
              <h3>Nobody here</h3>
              <div>Nothing in this bucket right now.</div>
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
              <table style={{ border: "none" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>AREF I – Stage</th>
                    <th>Prospect type</th>
                    <th>Last edited</th>
                    <th>Last sent</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name}
                        {r.doNotContact && <span className="tag rust" style={{ marginLeft: 6 }}>Do not contact</span>}
                      </td>
                      <td className="muted">
                        {r.email ?? "—"}
                        {r.heldBack && (
                          <span className="tag" style={{ marginLeft: 6 }}>
                            held back — no real email
                          </span>
                        )}
                      </td>
                      <td>{FUNDRAISING_STAGE_LABELS[r.status]}</td>
                      <td className="muted">
                        {r.recordContexts.length > 0 ? r.recordContexts.map((c) => RECORD_CONTEXT_LABELS[c]).join(", ") : "—"}
                      </td>
                      <td className="muted">{formatDate(r.updatedAt)}</td>
                      <td className="muted">{formatDate(r.lastSent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
