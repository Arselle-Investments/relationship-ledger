import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { getOverdueContacts } from "@/lib/followups";
import { getOverdueSequenceContacts } from "@/lib/sequences";
import { getSettings } from "@/lib/settings";
import { TaskPriority, TaskStatus } from "@prisma/client";

const CADENCE_PREFIX = "Follow up:";
const SEQUENCE_PREFIX = "Sequence step:";

const schema = z.object({
  cadenceContactIds: z.array(z.string()).default([]),
  sequenceContactIds: z.array(z.string()).default([]),
});

/**
 * Converts the selected overdue follow-ups (cadence and/or sequence step)
 * into Tasks, so they show up on the Kanban board the team already works
 * from. Dedups against open tasks with the same contact + title prefix, so
 * re-running this after selecting overlapping contacts never piles up
 * duplicates for the same follow-up.
 */
export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { cadenceContactIds, sequenceContactIds } = parsed.data;
  if (cadenceContactIds.length === 0 && sequenceContactIds.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  const [contacts, settings, openTasks] = await Promise.all([
    prisma.contact.findMany({ include: { owner: true, warmPath: true } }),
    getSettings(),
    prisma.task.findMany({ where: { status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } } }),
  ]);

  const existingKey = (contactId: string, prefix: string) =>
    openTasks.some((t) => t.contactId === contactId && t.title.startsWith(prefix));

  const overdueCadence = getOverdueContacts(contacts, settings.defaultCadenceDays).filter((c) =>
    cadenceContactIds.includes(c.id)
  );
  const overdueSequence = getOverdueSequenceContacts(contacts).filter((c) => sequenceContactIds.includes(c.id));

  const toCreate: { title: string; contactId: string; ownerId: string | null; priority: TaskPriority }[] = [];

  for (const c of overdueCadence) {
    if (existingKey(c.id, CADENCE_PREFIX)) continue;
    toCreate.push({
      title: `${CADENCE_PREFIX} ${c.name}`,
      contactId: c.id,
      ownerId: c.ownerId,
      priority: TaskPriority.MEDIUM,
    });
  }
  for (const c of overdueSequence) {
    if (existingKey(c.id, SEQUENCE_PREFIX)) continue;
    toCreate.push({
      title: `${SEQUENCE_PREFIX} ${c.step.title} (${c.name})`,
      contactId: c.id,
      ownerId: c.ownerId,
      priority: TaskPriority.MEDIUM,
    });
  }

  if (toCreate.length > 0) {
    await prisma.task.createMany({
      data: toCreate.map((t) => ({
        title: t.title,
        contactId: t.contactId,
        ownerId: t.ownerId,
        priority: t.priority,
        status: TaskStatus.OPEN,
        dueDate: new Date(),
      })),
    });
  }

  return NextResponse.json({
    created: toCreate.length,
    skipped: overdueCadence.length + overdueSequence.length - toCreate.length,
  });
}
