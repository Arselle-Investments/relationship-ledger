"use client";

import { ContactWithRelations } from "@/types/contact";
import { ViewField } from "./ViewField";

// Columns already surfaced as their own fields/sections elsewhere in the
// modal — repeating them in the raw dump below would just be noise.
const ALREADY_SHOWN = new Set([
  "TITLE", "JOB TITLE", "FIRST NAME", "LAST NAME", "EMAIL", "PHONE NO.", "COMPANY", "TAGS",
  "STAFF MEMBERS", "TYPE", "NOTES", "PRIMARY LOCATION", "CITY",
  "LOW COMMITMENT (EST.)", "HIGH COMMITMENT (EST.)", "TIER FOR EMAIL TRACKING",
]);

export function isBlank(v: unknown): boolean {
  if (v == null) return true;
  const t = String(v).trim().replace(/^'/, "").trim();
  return t === "" || t === "-" || t.toLowerCase() === "n/a";
}

function titleCase(header: string): string {
  return header.charAt(0) + header.slice(1).toLowerCase();
}

// Every Agora-sourced field, shown unconditionally in the same label/value
// format as the contact's own fields above — no separate compact grid, no
// "show more" toggle to hide behind.
export function ContactAgoraSection({ contact }: { contact: ContactWithRelations }) {
  const raw = (contact.agoraRaw as unknown as Record<string, string> | null) ?? null;
  const extraFields = raw ? Object.entries(raw).filter(([header, v]) => !ALREADY_SHOWN.has(header) && !isBlank(v)) : [];

  const hasCore =
    contact.agoraType ||
    contact.primaryLocation ||
    contact.staffNames.length > 0 ||
    contact.commitmentLow != null ||
    contact.commitmentHigh != null ||
    contact.emailTier != null;
  if (!hasCore && extraFields.length === 0) return null;

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
      {contact.agoraType && <ViewField label="Agora type" value={contact.agoraType} />}
      {contact.primaryLocation && <ViewField label="Primary location" value={contact.primaryLocation} />}
      {contact.staffNames.length > 0 && <ViewField label="Staff members" value={contact.staffNames.join(", ")} />}
      {(contact.commitmentLow != null || contact.commitmentHigh != null) && (
        <ViewField
          label="Est. commitment"
          value={`${contact.commitmentLow != null ? `$${contact.commitmentLow}mm` : "?"} – ${
            contact.commitmentHigh != null ? `$${contact.commitmentHigh}mm` : "?"
          }`}
        />
      )}
      {contact.emailTier != null && <ViewField label="Email tracking tier" value={`Tier ${contact.emailTier}`} />}
      {extraFields.map(([header, v]) => (
        <ViewField key={header} label={titleCase(header)} value={v} />
      ))}
    </div>
  );
}
