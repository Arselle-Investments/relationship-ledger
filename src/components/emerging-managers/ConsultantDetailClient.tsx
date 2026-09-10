"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CapitalSource, FundraisingStage, Consultant } from "@prisma/client";
import { EM_STAGE_LABELS } from "@/lib/contact-constants";
import { EmCorrespondenceTimeline } from "./EmCorrespondenceTimeline";

type ConsultantWithSources = Consultant & { capitalSources: CapitalSource[] };

function Field({
  label,
  value,
  onSave,
  canEdit,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  canEdit: boolean;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div className="field">
      <label>{label}</label>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && onSave(local)}
        disabled={!canEdit}
        style={{ minHeight: 70 }}
      />
    </div>
  );
}

export function ConsultantDetailClient({
  initialConsultant,
  canEdit,
  isAdmin,
}: {
  initialConsultant: ConsultantWithSources;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [consultant, setConsultant] = useState(initialConsultant);

  async function patch(data: Record<string, unknown>) {
    const res = await fetch(`/api/consultants/${consultant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      setConsultant(json.consultant);
    }
  }

  async function reload() {
    const res = await fetch(`/api/consultants/${consultant.id}`);
    if (res.ok) {
      const json = await res.json();
      setConsultant(json.consultant);
    }
  }

  async function deleteConsultant() {
    if (!confirm(`Delete "${consultant.name}"? Any capital sources linked to it will just become unlinked, not deleted.`)) return;
    const res = await fetch(`/api/consultants/${consultant.id}`, { method: "DELETE" });
    if (res.ok) router.push("/consultants");
  }

  const field = (key: keyof Consultant, label: string) => (
    <Field label={label} value={(consultant[key] as string) ?? ""} onSave={(v) => patch({ [key]: v })} canEdit={canEdit} />
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/consultants" className="btn small ghost">
          &larr; All consultants
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 0 }}>{consultant.name}</h2>
        {canEdit && (
          <select value={consultant.outreachStatus} onChange={(e) => patch({ outreachStatus: e.target.value as FundraisingStage })}>
            {Object.values(FundraisingStage).map((s) => (
              <option key={s} value={s}>
                {EM_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {field("capitalSourcesCoveredNote", "Capital sources covered (freeform)")}
        {field("intakeProcess", "Intake process / form")}
        {field("knownContacts", "Known contact(s)")}
        {field("nextStep", "Next step")}
        {field("verificationNotes", "Verification notes")}
        {field("notes", "Notes")}
      </div>

      <EmCorrespondenceTimeline
        entityType="consultant"
        entityId={consultant.id}
        canEdit={canEdit}
        onStatusChanged={reload}
      />

      <h3 style={{ marginBottom: 10, fontSize: 14 }}>Capital sources linked here ({consultant.capitalSources.length})</h3>
      {consultant.capitalSources.length === 0 ? (
        <div className="empty">
          <h3>None linked</h3>
          <div>Set this consultant on a capital source&rsquo;s detail page to link it here.</div>
        </div>
      ) : (
        <table style={{ marginBottom: 20 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {consultant.capitalSources.map((cs) => (
              <tr key={cs.id}>
                <td className="name-cell">
                  <Link href={`/capital-sources/${cs.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {cs.name}
                  </Link>
                </td>
                <td>
                  <span className="tag brass">{EM_STAGE_LABELS[cs.outreachStatus]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isAdmin && (
        <button className="btn btn-danger" onClick={deleteConsultant}>
          Delete this consultant
        </button>
      )}
    </div>
  );
}
