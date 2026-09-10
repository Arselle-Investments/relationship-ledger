"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Company, Contact, Deal, DealFeedback, DealOutreach, DealStatus, FundraisingStage } from "@prisma/client";
import {
  DEAL_ASSET_CLASS_OPTIONS,
  DEAL_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_TAG_CLASS,
} from "@/lib/deal-constants";

type FeedbackWithRelations = DealFeedback & { company: Company | null; contact: Contact | null };
type OutreachWithCompany = DealOutreach & { company: Company };
type DealWithFeedback = Deal & { feedback: FeedbackWithRelations[]; outreach: OutreachWithCompany[] };
type SlimCompany = { id: string; name: string };
type SlimContact = { id: string; name: string; companyId: string | null };

export function DealDetailClient({
  initialDeal,
  companies,
  contacts,
  canEdit,
  isAdmin,
}: {
  initialDeal: DealWithFeedback;
  companies: SlimCompany[];
  contacts: SlimContact[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [deal, setDeal] = useState(initialDeal);
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [status, setStatus] = useState<FundraisingStage>(FundraisingStage.NOT_STARTED);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingNotes, setEditingNotes] = useState(deal.notes ?? "");
  const [sentSearch, setSentSearch] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const outreachByCompanyId = useMemo(() => new Map(deal.outreach.map((o) => [o.companyId, o])), [deal.outreach]);
  const sentSearchResults = useMemo(() => {
    const q = sentSearch.trim().toLowerCase();
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;
  }, [companies, sentSearch]);

  const contactsForCompany = useMemo(
    () => (companyId ? contacts.filter((c) => c.companyId === companyId) : []),
    [companyId, contacts]
  );

  async function updateStatus(next: DealStatus) {
    if (!canEdit) return;
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const json = await res.json();
      setDeal((prev) => ({ ...prev, status: json.deal.status }));
    }
  }

  async function updateAssetClass(next: string) {
    if (!canEdit) return;
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetClass: next || null }),
    });
    if (res.ok) {
      const json = await res.json();
      setDeal((prev) => ({ ...prev, assetClass: json.deal.assetClass }));
    }
  }

  async function saveNotes() {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editingNotes }),
    });
    if (res.ok) setDeal((prev) => ({ ...prev, notes: editingNotes }));
  }

  async function addFeedback() {
    setError(null);
    if (!companyId && !contactId) {
      setError("Pick a company or a contact first.");
      return;
    }
    if (!notes.trim()) {
      setError("Notes are required.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/deals/${deal.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyId || null, contactId: contactId || null, status, notes: notes.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setDeal((prev) => ({ ...prev, feedback: [json.feedback, ...prev.feedback] }));
    setCompanyId("");
    setContactId("");
    setStatus(FundraisingStage.NOT_STARTED);
    setNotes("");
  }

  async function toggleSent(company: SlimCompany, currentlySent: boolean) {
    if (!canEdit || togglingId) return;
    setSendError(null);
    setTogglingId(company.id);
    if (currentlySent) {
      const outreach = outreachByCompanyId.get(company.id);
      if (outreach) {
        const res = await fetch(`/api/deal-outreach/${outreach.id}`, { method: "DELETE" });
        if (res.ok) setDeal((prev) => ({ ...prev, outreach: prev.outreach.filter((o) => o.id !== outreach.id) }));
        else setSendError("Something went wrong.");
      }
    } else {
      const res = await fetch(`/api/deals/${deal.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setDeal((prev) => ({ ...prev, outreach: [json.outreach, ...prev.outreach.filter((o) => o.companyId !== company.id)] }));
      } else {
        setSendError(json.error ?? "Something went wrong.");
      }
    }
    setTogglingId(null);
  }

  async function deleteFeedback(id: string) {
    if (!confirm("Delete this feedback entry?")) return;
    const res = await fetch(`/api/deal-feedback/${id}`, { method: "DELETE" });
    if (res.ok) setDeal((prev) => ({ ...prev, feedback: prev.feedback.filter((f) => f.id !== id) }));
  }

  async function deleteDeal() {
    if (!confirm(`Delete "${deal.name}" and all its feedback? This cannot be undone.`)) return;
    const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
    if (res.ok) router.push("/deals");
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/deals" className="btn small ghost">
          &larr; All deals
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ marginBottom: 0 }}>{deal.name}</h2>
        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <select value={deal.assetClass ?? ""} onChange={(e) => updateAssetClass(e.target.value)}>
              <option value="">Asset class: none yet</option>
              {DEAL_ASSET_CLASS_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={deal.status} onChange={(e) => updateStatus(e.target.value as DealStatus)}>
              {Object.values(DealStatus).map((s) => (
                <option key={s} value={s}>
                  {DEAL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {!canEdit && deal.assetClass && (
        <div className="muted" style={{ fontSize: 12.5, marginTop: -12, marginBottom: 16 }}>{deal.assetClass}</div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <label style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-soft)" }}>
          Deal notes
        </label>
        <textarea
          value={editingNotes}
          onChange={(e) => setEditingNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={!canEdit}
          style={{ width: "100%", minHeight: 70, marginTop: 6 }}
          placeholder="General notes about this deal, not tied to one company"
        />
      </div>

      {canEdit && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>Add feedback</h3>
          <div className="field-row">
            <div className="field">
              <label>Company</label>
              <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setContactId(""); }}>
                <option value="">— none —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Contact (optional)</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!companyId}>
                <option value="">— company-level —</option>
                {contactsForCompany.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as FundraisingStage)} style={{ maxWidth: 220 }}>
              {Object.values(FundraisingStage).map((s) => (
                <option key={s} value={s}>
                  {FEEDBACK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did they say?" />
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <button className="btn primary" onClick={addFeedback} disabled={busy}>
            {busy ? "Adding…" : "Add feedback"}
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 4, fontSize: 14 }}>Sent to ({deal.outreach.length} of {companies.length})</h3>
        <div className="helptext" style={{ marginBottom: 12 }}>
          Tracks who this deal was actually sent to, separate from feedback. Use this even when a company hasn&rsquo;t responded with anything worth logging yet. Search to confirm whether a specific company got it.
        </div>
        <input
          type="text"
          placeholder="Search companies..."
          value={sentSearch}
          onChange={(e) => setSentSearch(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />
        {sendError && <div className="error-text" style={{ marginBottom: 8 }}>{sendError}</div>}
        {sentSearchResults.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>No companies match &ldquo;{sentSearch}&rdquo;.</div>
        ) : (
          <div className="checkbox-list" style={{ maxHeight: 320 }}>
            {sentSearchResults.map((c) => {
              const sent = outreachByCompanyId.has(c.id);
              return (
                <label key={c.id} style={{ opacity: togglingId === c.id ? 0.6 : 1 }}>
                  <input
                    type="checkbox"
                    checked={sent}
                    disabled={!canEdit || togglingId !== null}
                    onChange={() => toggleSent(c, sent)}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <h3 style={{ marginBottom: 12, fontSize: 14 }}>Feedback ({deal.feedback.length})</h3>
      {deal.feedback.length === 0 ? (
        <div className="empty">
          <h3>No feedback yet</h3>
          <div>Add feedback above as it comes in from calls, emails, or Teams messages.</div>
        </div>
      ) : (
        deal.feedback.map((f) => (
          <div key={f.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {f.company?.name}
                  {f.contact ? ` · ${f.contact.name}` : ""}
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  {new Date(f.createdAt).toLocaleDateString()}
                  {f.createdByName ? ` · ${f.createdByName}` : ""}
                </div>
              </div>
              <span className={`tag ${FEEDBACK_STATUS_TAG_CLASS[f.status]}`}>{FEEDBACK_STATUS_LABELS[f.status]}</span>
            </div>
            <div style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap" }}>{f.notes}</div>
            {canEdit && (
              <button className="btn small ghost btn-danger" style={{ marginTop: 8 }} onClick={() => deleteFeedback(f.id)}>
                Delete
              </button>
            )}
          </div>
        ))
      )}

      {isAdmin && (
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-danger" onClick={deleteDeal}>
            Delete this deal
          </button>
        </div>
      )}
    </div>
  );
}
