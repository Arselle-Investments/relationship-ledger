import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor } from "@/lib/permissions";
import { TaskPriority, TaskStatus } from "@prisma/client";

const schema = z.object({
  contactIds: z.array(z.string()).min(1, "Select at least one contact."),
  title: z.string().trim().min(1, "Title is required."),
  ownerId: z.string().trim().optional().nullable(),
  assigneeLabel: z.string().trim().optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  notes: z.string().optional().default(""),
});

/**
 * Creates the same task (title/assignee/due date/priority/notes) for every
 * contact in contactIds — one Task row per contact. Used by the Funnel view's
 * "select a handful, or all, and create a task" bulk action.
 */
export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;
  const ownerId = data.assigneeLabel ? null : data.ownerId || actingUser.id;

  const result = await prisma.task.createMany({
    data: data.contactIds.map((contactId) => ({
      title: data.title,
      contactId,
      ownerId,
      assigneeLabel: data.assigneeLabel || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status,
      priority: data.priority,
      notes: data.notes ?? "",
    })),
  });

  return NextResponse.json({ created: result.count }, { status: 201 });
}
