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

// The people who actually pick up and execute tasks day to day — everyone
// else on the User table (an account owner, other staff not doing hands-on
// outreach) shouldn't show up as an assignable task owner, and "Team" means
// this trio specifically rather than literally every User row.
export const TASK_TEAM_EMAILS = ["aaron@arselleinvestments.com", "kev@arselleinvestments.com", "bianca@arselleinvestments.com"];
