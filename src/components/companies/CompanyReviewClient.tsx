"use client";

import { useState } from "react";
import { Company } from "@prisma/client";

type CompanyWithCounts = Company & { _count: { contacts: number; feedback: number; outreach: number }; fromAgora: boolean };

function defaultPrimary(cluster: CompanyWithCounts[]): string {
  // The name already in use on the real Companies tab (from Agora) wins when
  // there's exactly one such record in the cluster — that's the trusted one,
  // not whichever the messier capital-partner import happened to create.
  const agoraOnes = cluster.filter((c) => c.fromAgora);
  if (agoraOnes.length === 1) return agoraOnes[0].id;
  // Otherwise fall back to whichever has the most activity attached.
  const activity = (c: CompanyWithCounts) => c._count.contacts + c._count.feedback + c._count.outreach;
  return cluster.reduce((best, c) => (activity(c) > activity(best) ? c : best), cluster[0]).id;
}

export function CompanyReviewClient({
  initialClusters,
  canEdit,
}: {
  initialClusters: CompanyWithCounts[][];
  canEdit: boolean;
}) {
  const [clusters, setClusters] = useState(initialClusters);
  const [primaryByCluster, setPrimaryByCluster] = useState<Record<number, string>>(
    Object.fromEntries(initialClusters.map((cluster, i) => [i, defaultPrimary(cluster)]))
  );
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function removeCluster(index: number) {
    setClusters((prev) => prev.filter((_, i) => i !== index));
  }

  async function mergeCluster(index: number, cluster: CompanyWithCounts[]) {
    setError(null);
    const primaryId = primaryByCluster[index];
    const secondaryIds = cluster.filter((c) => c.id !== primaryId).map((c) => c.id);
    setBusyIndex(index);
    const res = await fetch("/api/companies/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, secondaryIds }),
    });
    const json = await res.json();
    setBusyIndex(null);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    removeCluster(index);
  }

  async function dismissCluster(index: number, cluster: CompanyWithCounts[]) {
    setError(null);
    setBusyIndex(index);
    const res = await fetch("/api/companies/merge-dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyIds: cluster.map((c) => c.id) }),
    });
    setBusyIndex(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong.");
      return;
    }
    removeCluster(index);
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        Companies that look like the same capital partner written differently
      </div>
      <div className="helptext" style={{ marginBottom: 20 }}>
        Grouped by name (case, punctuation, and endings like &ldquo;Inc.&rdquo; or &ldquo;Holdings&rdquo; ignored), never
        merged automatically. Pick which record to keep, or confirm they&rsquo;re actually different companies.
      </div>

      {error && <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>}

      {clusters.length === 0 ? (
        <div className="empty">
          <h3>Nothing to review</h3>
          <div>No name-alike company clusters waiting on a decision.</div>
        </div>
      ) : (
        clusters.map((cluster, index) => {
          const key = cluster.map((c) => c.id).join(",");
          const primaryId = primaryByCluster[index];
          const busy = busyIndex === index;
          const agoraCount = cluster.filter((c) => c.fromAgora).length;
          return (
            <div key={key} className="card" style={{ padding: 16, marginBottom: 14 }}>
              {agoraCount === 0 && (
                <div className="helptext" style={{ marginBottom: 10, color: "var(--rust)" }}>
                  None of these match an existing Agora record — pick the name to keep manually.
                </div>
              )}
              <table style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Company</th>
                    <th>Contacts</th>
                    <th>Deal feedback</th>
                    <th>Deals sent</th>
                  </tr>
                </thead>
                <tbody>
                  {cluster.map((c) => (
                    <tr key={c.id}>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <input
                            type="radio"
                            name={`primary-${index}`}
                            checked={primaryId === c.id}
                            onChange={() => setPrimaryByCluster((prev) => ({ ...prev, [index]: c.id }))}
                          />
                        )}
                      </td>
                      <td className="name-cell">
                        {c.name}
                        {c.fromAgora && (
                          <span className="tag forest" style={{ marginLeft: 6 }}>
                            Agora
                          </span>
                        )}
                      </td>
                      <td className="muted">{c._count.contacts}</td>
                      <td className="muted">{c._count.feedback}</td>
                      <td className="muted">{c._count.outreach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn small primary" onClick={() => mergeCluster(index, cluster)} disabled={busy}>
                    {busy ? "Working…" : "Merge into selected"}
                  </button>
                  <button className="btn small ghost" onClick={() => dismissCluster(index, cluster)} disabled={busy}>
                    Not duplicates
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
