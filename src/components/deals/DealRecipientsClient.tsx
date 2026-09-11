"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Company, Contact, Deal, DealFeedback, DealOutreach } from "@prisma/client";
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUS_TAG_CLASS } from "@/lib/deal-constants";
import { SortHeader, SortKey, useSort } from "@/components/SortHeader";

type FeedbackWithRelations = DealFeedback & { deal: Deal; contact: Contact | null };
type OutreachWithDeal = DealOutreach & { deal: Deal };
type CompanyWithDealActivity = Company & {
  feedback: FeedbackWithRelations[];
  outreach: OutreachWithDeal[];
  _count: { contacts: number };
};

type SortField = "name" | "city" | "contacts" | "outreach" | "feedback";

export function DealRecipientsClient({ companies }: { companies: CompanyWithDealActivity[] }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { sortKey, toggleSort } = useSort<SortField>("name");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;
    return [...rows].sort((a, b) => {
      const dir = sortKey.dir === "asc" ? 1 : -1;
      switch (sortKey.field) {
        case "city":
          return dir * (a.city ?? "").localeCompare(b.city ?? "");
        case "contacts":
          return dir * (a._count.contacts - b._count.contacts);
        case "outreach":
          return dir * (a.outreach.length - b.outreach.length);
        case "feedback":
          return dir * (a.feedback.length - b.feedback.length);
        default:
          return dir * a.name.localeCompare(b.name);
      }
    });
  }, [companies, search, sortKey]);

  const active = selectedId ? companies.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="spacer" />
      </div>

      <div className="helptext" style={{ marginBottom: 12 }}>
        {filtered.length} of {companies.length} companies that have received at least one deal
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No companies found</h3>
          <div>{companies.length === 0 ? "No deals have been sent to any company yet." : "Try adjusting your search."}</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <SortHeader field="name" label="Company" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="city" label="City" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="contacts" label="Contacts" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="outreach" label="Deals sent" sortKey={sortKey} onSort={toggleSort} />
              <SortHeader field="feedback" label="Feedback received" sortKey={sortKey} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => setSelectedId(c.id)}>
                <td className="name-cell">{c.name}</td>
                <td className="muted">{c.city || "—"}</td>
                <td className="muted">{c._count.contacts}</td>
                <td className="muted">{c.outreach.length}</td>
                <td className="muted">{c.feedback.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {active && (
        <div className="overlay open" onClick={() => setSelectedId(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{active.name}</h2>
              <button className="close-x" onClick={() => setSelectedId(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {active.outreach.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 6 }}>
                    Deals sent ({active.outreach.length})
                  </div>
                  {active.outreach.map((o) => (
                    <Link key={o.id} href={`/deals/${o.dealId}`} className="tag brass" style={{ textDecoration: "none" }}>
                      {o.deal.name}
                    </Link>
                  ))}
                </div>
              )}

              {active.feedback.length > 0 && (
                <>
                  <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
                    Deal feedback ({active.feedback.length})
                  </div>
                  {active.feedback.map((f) => (
                    <div key={f.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <Link href={`/deals/${f.dealId}`} style={{ fontWeight: 600, fontSize: 13 }}>
                          {f.deal.name}
                        </Link>
                        <span className={`tag ${FEEDBACK_STATUS_TAG_CLASS[f.status]}`}>{FEEDBACK_STATUS_LABELS[f.status]}</span>
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap" }}>{f.notes}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {new Date(f.createdAt).toLocaleDateString()}
                        {f.contact ? ` · ${f.contact.name}` : ""}
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div style={{ marginTop: 8 }}>
                <Link href="/companies" className="settings-link" style={{ padding: 0, fontSize: 12 }}>
                  Open full company record →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
