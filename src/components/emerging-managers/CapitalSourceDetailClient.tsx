"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CapitalSource, FundraisingStage, Consultant } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { EmCorrespondenceTimeline } from "./EmCorrespondenceTimeline";

type CapitalSourceWithConsultant = CapitalSource & { consultant: Consultant | null };

function Field({
  label,
  value,
  onSave,
  canEdit,
  multiline = true,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  canEdit: boolean;
  multiline?: boolean;
}) {
  const [local, setLocal] = useState(value);
  return (
    <div className="field">
      <label>{label}</label>
      {multiline ? (
        <textarea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onSave(local)}
          disabled={!canEdit}
          style={{ minHeight: 70 }}
        />
      ) : (
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onSave(local)}
          disabled={!canEdit}
        />
      )}
    </div>
  );
}

export function CapitalSourceDetailClient({
  initialCapitalSource,
  consultants,
  canEdit,
  isAdmin,
}: {
  initialCapitalSource: CapitalSourceWithConsultant;
  consultants: Consultant[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [cs, setCs] = useState(initialCapitalSource);

  async function patch(data: Record<string, unknown>) {
    const res = await fetch(`/api/capital-sources/${cs.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      setCs(json.capitalSource);
    }
  }

  async function reload() {
    const res = await fetch(`/api/capital-sources/${cs.id}`);
    if (res.ok) {
      const json = await res.json();
      setCs(json.capitalSource);
    }
  }

  async function deleteCapitalSource() {
    if (!confirm(`Delete "${cs.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/capital-sources/${cs.id}`, { method: "DELETE" });
    if (res.ok) router.push("/capital-sources");
  }

  const field = (key: keyof CapitalSource, label: string, multiline = true) => (
    <Field
      label={label}
      value={(cs[key] as string) ?? ""}
      onSave={(v) => patch({ [key]: v })}
      canEdit={canEdit}
      multiline={multiline}
    />
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/capital-sources" className="btn small ghost">
          &larr; All capital sources
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>
            {cs.name}
            {cs.tier && (
              <span className="tag brass" style={{ marginLeft: 10, verticalAlign: "middle" }}>
                Tier {cs.tier}
              </span>
            )}
          </h2>
          {cs.shortName && <div className="muted" style={{ fontSize: 12.5 }}>{cs.shortName}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {canEdit ? (
            <>
              <select
                value={cs.tier ?? ""}
                onChange={(e) => patch({ tier: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">No tier</option>
                <option value="1">Tier 1</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
                <option value="4">Tier 4</option>
              </select>
              <select value={cs.consultantId ?? ""} onChange={(e) => patch({ consultantId: e.target.value || null })}>
                <option value="">No consultant linked</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select value={cs.outreachStatus} onChange={(e) => patch({ outreachStatus: e.target.value as FundraisingStage })}>
                {Object.values(FundraisingStage).map((s) => (
                  <option key={s} value={s}>
                    {FUNDRAISING_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="tag brass">{FUNDRAISING_STAGE_LABELS[cs.outreachStatus]}</span>
          )}
          {cs.consultant && (
            <Link href={`/consultants/${cs.consultant.id}`} className="btn small ghost">
              View consultant: {cs.consultant.name}
            </Link>
          )}
        </div>
      </div>

      <EmCorrespondenceTimeline entityType="capitalSource" entityId={cs.id} canEdit={canEdit} onStatusChanged={reload} />

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Outreach</h3>
        <div className="field-row">
          {field("timing", "Timing")}
          {field("actionability", "Actionability", false)}
        </div>
        {field("nextStep", "Next step")}
        {field("keyContact", "Key contact")}
        {field("emailsWebsites", "Emails / websites")}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Consultant &amp; known commitments</h3>
        <div className="field-row">
          {field("programManager", "Program manager", false)}
          {field("consultantSource", "Consultant source", false)}
        </div>
        {field("knownCommitmentsCompetitors", "Known commitments (competitors)")}
        {field("knownCommitmentsOperators", "Known commitments (operators)")}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Program details</h3>
        {field("overview", "Overview")}
        {field("openDoorPolicy", "Open-door policy")}
        <div className="field-row">
          {field("minimumFundSize", "Minimum fund size", false)}
          {field("typicalCheckSize", "Typical check size", false)}
        </div>
        {field("minimumFundSizeSource", "Minimum fund size (source)")}
        {field("typicalCheckSizeSource", "Typical check size (source)")}
        {field("timeline", "Timeline")}
        {field("capitalStatus", "Capital status (their own program, not our outreach)")}
        {field("capitalStatusSource", "Capital status (source)")}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14 }}>Assessment</h3>
        {field("redFlags", "Red flags")}
        {field("arselleFit", "Arselle fit")}
        {field("actionPlanSource", "Action plan source")}
        {field("notes", "Notes")}
      </div>

      {isAdmin && (
        <button className="btn btn-danger" onClick={deleteCapitalSource}>
          Delete this capital source
        </button>
      )}
    </div>
  );
}
