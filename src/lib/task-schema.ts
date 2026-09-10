import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  contactId: z.string().trim().optional().nullable(),
  assigneeIds: z.array(z.string()).default([]),
  dueDate: z.string().trim().optional().nullable(), // ISO date string
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  notes: z.string().optional().default(""),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
