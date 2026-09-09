"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Consultant, FundraisingStage } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

type ConsultantWithCount = Consultant & { _count: { capitalSources: number } };

export function ConsultantsClient({
  initialConsultants,
  canEdit,
}: {
  initialConsultants: ConsultantWithCount[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [consultants, setConsultants] = useState(initialConsultants);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createConsultant() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/consultants", {
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
    setConsultants((prev) => [...prev, { ...json.consultant, _count: { capitalSources: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setAdding(false);
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Consultants that gate access to capital sources — intake process, known contacts, and which sources each one covers.
      </div>
      <div className="toolbar">
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add consultant"}
          </button>
        )}
      </div>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Callan" />
          </div>
          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <button className="btn primary" onClick={createConsultant} disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      <div className="helptext" style={{ marginBottom: 12 }}>
        {consultants.length} consultant{consultants.length === 1 ? "" : "s"}
      </div>

      {consultants.length === 0 ? (
        <div className="empty">
          <h3>No consultants yet</h3>
          <div>Add one to start tracking intake and coverage.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Capital sources covered</th>
            </tr>
          </thead>
          <tbody>
            {consultants.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/consultants/${c.id}`)} style={{ cursor: "pointer" }}>
                <td className="name-cell">
                  <Link
                    href={`/consultants/${c.id}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.name}
                  </Link>
                </td>
                <td>
                  <span className="tag brass">{FUNDRAISING_STAGE_LABELS[c.outreachStatus as FundraisingStage]}</span>
                </td>
                <td className="muted">{c._count.capitalSources}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
