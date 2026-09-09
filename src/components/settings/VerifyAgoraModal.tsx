"use client";

import { useEffect, useState } from "react";

type FieldKey = "org" | "phone" | "city" | "notes";

type Diff = { field: FieldKey; label: string; current: string | null; proposed: string };
type ResultItem = { contactId: string; name: string; diffs: Diff[] };

export function VerifyAgoraModal({ file, onClose }: { file: File; onClose: () => void }) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(0);
  const [matched, setMatched] = useState(0);
  const [items, setItems] = useState<ResultItem[]>([]);
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/contacts/verify-against-agora", { method: "POST", body: form });
      const json = await res.json();
      if (cancelled) return;
      setChecking(false);
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      setChecked(json.checked ?? 0);
      setMatched(json.matched ?? 0);
      setItems(json.withChanges ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyField(item: ResultItem, diff: Diff) {
    const res = await fetch(`/api/contacts/${item.contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [diff.field]: diff.proposed }),
    });
    if (!res.ok) return;
    setAppliedKeys((prev) => new Set(prev).add(`${item.contactId}:${diff.field}`));
  }

  async function applyAllForContact(item: ResultItem) {
    const data: Record<string, string> = {};
    for (const diff of item.diffs) data[diff.field] = diff.proposed;
    const res = await fetch(`/api/contacts/${item.contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    setAppliedKeys((prev) => {
      const next = new Set(prev);
      item.diffs.forEach((d) => next.add(`${item.contactId}:${d.field}`));
      return next;
    });
  }

  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Verify against Agora</h2>
          <button className="close-x" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {checking && <div className="helptext">Comparing this file against what&rsquo;s on file for each matching contact…</div>}
          {error && <div className="error-text">{error}</div>}

          {!checking && !error && (
            <>
              <div className="helptext" style={{ marginBottom: 14 }}>
                Checked {checked} row{checked === 1 ? "" : "s"}, matched {matched} existing contact{matched === 1 ? "" : "s"} by
                email. {items.length} {items.length === 1 ? "has" : "have"} a difference in organization, phone, city, or
                notes below. Nothing is changed until you click &ldquo;Use this&rdquo; or &ldquo;Use all.&rdquo;
              </div>

              {items.length === 0 ? (
                <div className="empty">
                  <h3>Nothing to reconcile</h3>
                  <div>Every matched contact already agrees with this file on organization, phone, city, and notes.</div>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.contactId} className="card" style={{ padding: 14, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <strong style={{ fontSize: 13 }}>{item.name}</strong>
                      <button className="btn small ghost" onClick={() => applyAllForContact(item)}>
                        Use all
                      </button>
                    </div>
                    {item.diffs.map((diff) => {
                      const applied = appliedKeys.has(`${item.contactId}:${diff.field}`);
                      return (
                        <div
                          key={diff.field}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}
                        >
                          <div style={{ fontSize: 12.5 }}>
                            <strong>{diff.label}:</strong> {diff.current ? <span className="muted">{diff.current}</span> : <span className="muted">(none)</span>}
                            {" → "}
                            {diff.proposed}
                          </div>
                          <button className="btn small ghost" onClick={() => applyField(item, diff)} disabled={applied}>
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
