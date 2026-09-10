import { TaskPriority, TaskStatus } from "@prisma/client";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

type NamedUser = { id: string; name: string | null; email: string };

/** Resolves assigneeIds against a team roster into display names, in the order given. */
export function assigneeNames(assigneeIds: string[], team: NamedUser[]): string[] {
  return assigneeIds.map((id) => {
    const u = team.find((u) => u.id === id);
    return u?.name || u?.email || "Former team member";
  });
}

/** "Unassigned" / "Aaron Greeno" / "Aaron Greeno, Kev Zoryan" for a task card, table cell, or export. */
export function formatAssignees(assigneeIds: string[], team: NamedUser[]): string {
  const names = assigneeNames(assigneeIds, team);
  return names.length > 0 ? names.join(", ") : "Unassigned";
}
