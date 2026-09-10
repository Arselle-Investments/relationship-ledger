import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { TRACKED_ENTITIES, TrackedEntityType, parseStoredValue, logEdit } from "@/lib/edit-log";

function isTrackedEntityType(v: string): v is TrackedEntityType {
  return v in TRACKED_ENTITIES;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;

  const entry = await prisma.editLogEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Edit not found." }, { status: 404 });
  if (entry.undone) return NextResponse.json({ error: "Already undone." }, { status: 400 });
  if (!isTrackedEntityType(entry.entityType)) {
    return NextResponse.json({ error: "This entry can't be undone." }, { status: 400 });
  }

  const entity = TRACKED_ENTITIES[entry.entityType];
  const current = await entity.findById(entry.entityId);
  if (!current) {
    return NextResponse.json({ error: "The record this change was made on no longer exists." }, { status: 400 });
  }

  const currentValue = (current as Record<string, unknown>)[entry.field];
  const revertedValue = parseStoredValue(entry.field, entry.oldValue);
  const updated = await entity.patch(entry.entityId, { [entry.field]: revertedValue });

  await prisma.editLogEntry.update({ where: { id }, data: { undone: true, undoneAt: new Date() } });

  // Log the undo itself as a normal edit (tagged so it reads as one in the
  // list) rather than a separate concept — it's just another change, made by
  // whoever clicked Undo.
  await logEdit({
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entity.label(updated as never),
    changedById: actingUser.id,
    changedByName: `${actingUser.name ?? actingUser.email ?? "Someone"} (undo)`,
    changes: [{ field: entry.field, oldValue: currentValue, newValue: revertedValue }],
  });

  return NextResponse.json({ ok: true });
}
