"use client";

import { useEffect, useState } from "react";
import { Event } from "@prisma/client";

type ConferenceRefreshResult = {
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  registrationStatus: string | null;
  registrationLink: string | null;
  registrationOpensAt: string | null;
  dateConfidence: string | null;
  fitNote: string | null;
  summary: string | null;
};

type ResultItem = {
  eventId: string;
  eventName: string;
  suggestion: ConferenceRefreshResult | null;
  error: string | null;
};

const FIELD_DEFS: { key: keyof ConferenceRefreshResult; label: string }[] = [
  { key: "startDate", label: "Start date" },
  { key: "endDate", label: "End date" },
  { key: "location", label: "Location" },
  { key: "registrationStatus", label: "Registration status" },
  { key: "registrationLink", label: "Registration link" },
  { key: "registrationOpensAt", label: "Registration opens" },
  { key: "dateConfidence", label: "Confidence" },
  { key: "fitNote", label: "Fit note" },
];

export function BulkConferenceRefreshModal({
  onClose,
  onEventUpdated,
}: {
  onClose: () => void;
  onEventUpdated: (event: Event) => void;
}) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [failed, setFailed] = useState<{ eventId: string; eventName: string; error: string | null }[]>([]);
  const [items, setItems] = useState<ResultItem[]>([]);
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/events/refresh-all", { method: "POST" });
      const json = await res.json();
      if (cancelled) return;
      setChecking(false);
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setChecked(json.checked ?? 0);
      setFailedCount(json.failedCount ?? 0);
      setFailed(json.failed ?? []);
      setItems(json.withUpdates ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyField(item: ResultItem, key: keyof ConferenceRefreshResult) {
    const value = item.suggestion?.[key];
    if (value === null || value === undefined) return;
    const res = await fetch(`/api/events/${item.eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) return;
    const json = await res.json();
    onEventUpdated(json.event);
    setAppliedKeys((prev) => new Set(prev).add(`${item.eventId}:${key}`));
  }

  async function applyAllForEvent(item: ResultItem) {
    if (!item.suggestion) return;
    const data: Record<string, unknown> = {};
    for (const { key } of FIELD_DEFS) {
      const value = item.suggestion[key];
      if (value !== null && value !== undefined) data[key] = value;
    }
    if (Object.keys(data).length === 0) return;
    const res = await fetch(`/api/events/${item.eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const json = await res.json();
    onEventUpdated(json.event);
    setAppliedKeys((prev) => {
      const next = new Set(prev);
      FIELD_DEFS.forEach(({ key }) => next.add(`${item.eventId}:${key}`));
      return next;
    });
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Refresh all conferences</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {checking && <div className="helptext">Checking every conference with a registration link on file…</div>}
          {error && <div className="error-text">{error}</div>}

          {!checking && !error && (
            <>
              <div className="helptext" style={{ marginBottom: 14 }}>
                Checked {checked} conference{checked === 1 ? "" : "s"}
                {failedCount > 0 ? ` — ${failedCount} couldn't be checked` : ""}. {items.length} have new or changed
                information below.
              </div>

              {failedCount > 0 && (
                <details style={{ marginBottom: 14 }}>
                  <summary className="helptext" style={{ cursor: "pointer" }}>
                    Why {failedCount} couldn&rsquo;t be checked
                  </summary>
                  <div style={{ marginTop: 8 }}>
                    {failed.map((f) => (
                      <div key={f.eventId} style={{ fontSize: 12.5, padding: "4px 0" }}>
                        <strong>{f.eventName}:</strong> <span className="muted">{f.error}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {items.length === 0 ? (
                <div className="empty">
                  <h3>Nothing new</h3>
                  <div>Every conference checked matches what&rsquo;s already on file.</div>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.eventId} className="card" style={{ padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>{item.eventName}</strong>
                      <button className="btn small ghost" onClick={() => applyAllForEvent(item)}>
                        Use all
                      </button>
                    </div>
                    {item.suggestion?.summary && (
                      <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                        {item.suggestion.summary}
                      </div>
                    )}
                    {FIELD_DEFS.filter(({ key }) => item.suggestion?.[key] != null).map(({ key, label }) => {
                      const applied = appliedKeys.has(`${item.eventId}:${key}`);
                      return (
                        <div
                          key={key}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "4px 0" }}
                        >
                          <div style={{ fontSize: 12.5 }}>
                            <strong>{label}:</strong> {item.suggestion![key]}
                          </div>
                          <button className="btn small ghost" onClick={() => applyField(item, key)} disabled={applied}>
                            {applied ? "Applied" : "Use this"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <span />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
