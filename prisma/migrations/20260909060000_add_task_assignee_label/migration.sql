-- Add a nullable free-text "assignee label" for jointly-assigned tasks
-- (e.g. "Aaron or Kev", "Team") that don't have a single accountable owner.
ALTER TABLE "Task" ADD COLUMN "assigneeLabel" TEXT;
