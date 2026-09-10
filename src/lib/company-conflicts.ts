import { Company } from "@prisma/client";

export type ConflictFieldKey = "city" | "tier" | "type" | "website" | "linkedinUrl" | "aum" | "founded" | "priorityQuarter";

export type ConflictField = {
  field: ConflictFieldKey;
  label: string;
  options: { value: string; source: string }[];
};

const CONFLICT_FIELDS: { field: ConflictFieldKey; label: string }[] = [
  { field: "city", label: "City" },
  { field: "tier", label: "Tier" },
  { field: "type", label: "Type" },
  { field: "website", label: "Website" },
  { field: "linkedinUrl", label: "LinkedIn" },
  { field: "aum", label: "AUM" },
  { field: "founded", label: "Founded" },
  { field: "priorityQuarter", label: "Priority quarter" },
];

/**
 * Single-value fields where merging two companies could silently drop real
 * data (arrays/tags/notes are always unioned, never a true conflict). "OTHER"
 * is ContactType's unset default, not a real value someone chose, so it never
 * counts as disagreeing with a real type the way two different real values do.
 */
export function detectCompanyConflicts(companies: Pick<Company, ConflictFieldKey | "name">[]): ConflictField[] {
  const conflicts: ConflictField[] = [];
  for (const { field, label } of CONFLICT_FIELDS) {
    const seen = new Map<string, string>();
    for (const c of companies) {
      const raw = c[field];
      let value = raw == null ? "" : String(raw).trim();
      if (field === "type" && value === "OTHER") value = "";
      if (!value) continue;
      if (!seen.has(value)) seen.set(value, c.name);
    }
    if (seen.size > 1) {
      conflicts.push({ field, label, options: Array.from(seen.entries()).map(([value, source]) => ({ value, source })) });
    }
  }
  return conflicts;
}

export function defaultResolutions(conflicts: ConflictField[], primary: Pick<Company, ConflictFieldKey>): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const c of conflicts) {
    const primaryValue = primary[c.field];
    const primaryStr = primaryValue == null ? "" : String(primaryValue).trim();
    defaults[c.field] = c.options.some((o) => o.value === primaryStr) ? primaryStr : c.options[0].value;
  }
  return defaults;
}
