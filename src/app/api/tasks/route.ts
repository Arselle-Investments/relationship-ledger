import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireEditor, requireUser } from "@/lib/permissions";
import { taskInputSchema } from "@/lib/task-schema";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    return errorResponse(e);
  }
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const contactId = searchParams.get("contactId");

  const tasks = await prisma.task.findMany({
    where: { ...(ownerId ? { ownerId } : {}), ...(contactId ? { contactId } : {}) },
    include: { owner: true, contact: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  let actingUser;
  try {
    actingUser = await requireEditor();
  } catch (e) {
    return errorResponse(e);
  }

  const body = await req.json();
  const parsed = taskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const data = parsed.data;

  const task = await prisma.task.create({
    data: {
      title: data.title,
      contactId: data.contactId || null,
      ownerId: data.ownerId || actingUser.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status,
      priority: data.priority,
      notes: data.notes ?? "",
    },
    include: { owner: true, contact: true },
  });
  return NextResponse.json({ task }, { status: 201 });
}

function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
}
