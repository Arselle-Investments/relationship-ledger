"use client";

import { useState } from "react";
import { ContactWithRelations } from "@/types/contact";
import { ContactNewsItem } from "@/lib/ai";

export function ContactResearchSection({
  contact,
  canEdit,
  onUpdated,
}: {
  contact: ContactWithRelations;
  canEdit: boolean;
  onUpdated: (contact: ContactWithRelations) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const news = (contact.researchNews as unknown as ContactNewsItem[] | null) ?? [];
  const hasRun = !!contact.researchUpdatedAt;

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/contacts/${contact.id}/research`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Research failed — try again in a moment.");
      return;
    }
    const json = await res.json();
    onUpdated(json.contact);
  }

  return (
    <div className="activity-log">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".04em",
            color: "var(--ink-soft)",
          }}
        >
          Research
        </label>
        {canEdit && (
          <button className="btn small" onClick={handleRefresh} disabled={loading}>
            {loading ? "Researching…" : hasRun ? "Refresh research" : "Research this contact"}
          </button>
        )}
      </div>

      {!hasRun && !loading && (
        <div className="helptext">
          Pulls a short bio and any recent news mentions from public web search — coverage varies a lot by how
          publicly visible this person is.
        </div>
      )}

      {loading && <div className="helptext">Searching the web and summarizing — this can take up to 30 seconds…</div>}

      {error && <div className="error-text">{error}</div>}

      {hasRun && !loading && (
        <>
          {contact.researchBio ? (
            <div className="activity-item">
              {contact.researchBio}
              {contact.researchBioSource && (
                <div style={{ marginTop: 4 }}>
                  <a href={contact.researchBioSource} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5 }}>
                    Source
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="activity-item muted">No public bio found.</div>
          )}

          {news.length > 0 ? (
            news.map((item, i) => (
              <div key={i} className="activity-item">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                {item.date && <span className="when" style={{ marginLeft: 6 }}>{item.date}</span>}
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                  {item.summary}
                </div>
              </div>
            ))
          ) : (
            <div className="activity-item muted">No recent news found.</div>
          )}

          <div className="helptext" style={{ marginTop: 4 }}>
            Last refreshed {new Date(contact.researchUpdatedAt!).toLocaleDateString()}
          </div>
        </>
      )}
    </div>
  );
}
