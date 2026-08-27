"use client";

import { Fragment, useState } from "react";
import { ContactWithRelations } from "@/types/contact";

// Columns already surfaced as their own fields/sections elsewhere in the
// modal — repeating them in the raw dump below would just be noise.
const ALREADY_SHOWN = new Set([
  "TITLE", "FIRST NAME", "LAST NAME", "EMAIL", "PHONE NO.", "COMPANY", "TAGS",
  "STAFF MEMBERS", "TYPE", "NOTES", "PRIMARY LOCATION", "CITY",
  "LOW COMMITMENT (EST.)", "HIGH COMMITMENT (EST.)", "TIER FOR EMAIL TRACKING",
]);

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  const t = String(v).trim().replace(/^'/, "").trim();
  return t === "" || t === "-" || t.toLowerCase() === "n/a";
}

function titleCase(header: string): string {
  return header.charAt(0) + header.slice(1).toLowerCase();
}

export function ContactAgoraSection({ contact }: { contact: ContactWithRelations }) {
  const [expanded, setExpanded] = useState(false);
  const raw = (contact.agoraRaw as unknown as Record<string, string> | null) ?? null;
  if (!raw) return null;

  const extraFields = Object.entries(raw).filter(([header, v]) => !ALREADY_SHOWN.has(header) && !isBlank(v));

  return (
    <div className="activity-log">
      <label
        style={{
          display: "block",
          fontSize: 11.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          color: "var(--ink-soft)",
          marginBottom: 8,
        }}
      >
        Agora profile
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 12.5 }}>
        {contact.agoraType && (
          <>
            <span className="muted">Agora type</span>
            <span>{contact.agoraType}</span>
          </>
        )}
        {contact.primaryLocation && (
          <>
            <span className="muted">Primary location</span>
            <span>{contact.primaryLocation}</span>
          </>
        )}
        {contact.staffNames.length > 0 && (
          <>
            <span className="muted">Staff members</span>
            <span>{contact.staffNames.join(", ")}</span>
          </>
        )}
        {(contact.commitmentLow != null || contact.commitmentHigh != null) && (
          <>
            <span className="muted">Est. commitment</span>
            <span>
              {contact.commitmentLow != null ? `$${contact.commitmentLow}mm` : "?"} –{" "}
              {contact.commitmentHigh != null ? `$${contact.commitmentHigh}mm` : "?"}
            </span>
          </>
        )}
        {contact.emailTier != null && (
          <>
            <span className="muted">Email tracking tier</span>
            <span>Tier {contact.emailTier}</span>
          </>
        )}
      </div>

      {extraFields.length > 0 && (
        <>
          <button type="button" className="btn small ghost" style={{ marginTop: 10 }} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Show"} all Agora fields ({extraFields.length})
          </button>
          {expanded && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 12.5, marginTop: 10 }}>
              {extraFields.map(([header, v]) => (
                <Fragment key={header}>
                  <span className="muted">{titleCase(header)}</span>
                  <span style={{ whiteSpace: "pre-wrap" }}>{v}</span>
                </Fragment>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
