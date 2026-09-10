import { prisma } from "@/lib/prisma";

// Entities the edit log currently tracks, and how to load/patch one by id —
// deliberately a short allowlist rather than every model, so undo only ever
// touches a field we understand. Add an entry here to extend logging/undo to
// another entity later.
export const TRACKED_ENTITIES = {
  Contact: {
    findById: (id: string) => prisma.contact.findUnique({ where: { id } }),
    patch: (id: string, data: Record<string, unknown>) => prisma.contact.update({ where: { id }, data }),
    label: (row: { name: string }) => row.name,
  },
  Company: {
    findById: (id: string) => prisma.company.findUnique({ where: { id } }),
    patch: (id: string, data: Record<string, unknown>) => prisma.company.update({ where: { id }, data }),
    label: (row: { name: string }) => row.name,
  },
} as const;

export type TrackedEntityType = keyof typeof TRACKED_ENTITIES;

// Human labels for the field names that actually get logged — camelCase
// elsewhere in the app, but this is the one place they're read as prose.
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  org: "Organization",
  type: "Type",
  tier: "Tier",
  status: "Stage",
  ownerId: "Owner",
  warmPathId: "Warm path",
  email: "Email",
  phone: "Phone",
  city: "City",
  lastContact: "Last contact",
  cadenceOverrideDays: "Cadence override",
  priorityQuarter: "Priority quarter",
  tags: "Tags",
  notes: "Notes",
  website: "Website",
  linkedinUrl: "LinkedIn",
  aum: "AUM",
  founded: "Founded",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// Most logged fields are plain strings (or enum values, which are just
// strings too) — only these need real parsing to turn a stored string back
// into the shape the field actually takes on the model.
const FIELD_KINDS: Record<string, "number" | "date" | "stringArray"> = {
  lastContact: "date",
  cadenceOverrideDays: "number",
  tags: "stringArray",
};

export function parseStoredValue(field: string, stored: string | null): unknown {
  const kind = FIELD_KINDS[field];
  if (stored === null) return kind === "stringArray" ? [] : null;
  switch (kind) {
    case "number":
      return Number(stored);
    case "date":
      return new Date(stored);
    case "stringArray":
      return stored.split(",").map((s) => s.trim()).filter(Boolean);
    default:
      return stored;
  }
}

function stringify(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export type FieldChange = { field: string; oldValue: unknown; newValue: unknown };

/**
 * Diffs oldValues against newValues for the given field list and writes one
 * EditLogEntry per field that actually changed. Called after a successful
 * update, from inside the same route that made it — not a generic Prisma
 * middleware, so it only ever covers fields a route explicitly reports.
 */
export async function logEdit({
  entityType,
  entityId,
  entityLabel,
  changedById,
  changedByName,
  changes,
}: {
  entityType: TrackedEntityType;
  entityId: string;
  entityLabel: string;
  changedById?: string | null;
  changedByName?: string | null;
  changes: FieldChange[];
}) {
  const rows = changes
    .map((c) => ({ field: c.field, oldValue: stringify(c.oldValue), newValue: stringify(c.newValue) }))
    .filter((c) => c.oldValue !== c.newValue);
  if (rows.length === 0) return;
  await prisma.editLogEntry.createMany({
    data: rows.map((c) => ({
      entityType,
      entityId,
      entityLabel,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      changedById: changedById ?? null,
      changedByName: changedByName ?? null,
    })),
  });
}
