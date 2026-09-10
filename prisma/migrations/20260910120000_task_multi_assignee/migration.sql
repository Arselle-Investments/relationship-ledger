-- Add the new multi-assignee column
ALTER TABLE "Task" ADD COLUMN "assigneeIds" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill from the old single ownerId
UPDATE "Task" SET "assigneeIds" = ARRAY["ownerId"] WHERE "ownerId" IS NOT NULL;

-- Backfill the "Team" sentinel to every current task-team member
UPDATE "Task"
SET "assigneeIds" = (
  SELECT array_agg("id") FROM "User"
  WHERE "email" IN ('aaron@arselleinvestments.com', 'kev@arselleinvestments.com', 'bianca@arselleinvestments.com')
)
WHERE "assigneeLabel" = 'Team';

-- Backfill joint free-text labels (e.g. "Aaron Greeno or Kev Zoryan") by
-- matching every team member whose name appears as a substring of the label
UPDATE "Task" t
SET "assigneeIds" = (
  SELECT array_agg(u."id") FROM "User" u
  WHERE t."assigneeLabel" LIKE '%' || u."name" || '%'
)
WHERE t."assigneeLabel" IS NOT NULL AND t."assigneeLabel" != 'Team' AND t."assigneeLabel" != '';

-- Drop the old single-owner column and the free-text joint-assignee hack
ALTER TABLE "Task" DROP CONSTRAINT "Task_ownerId_fkey";
DROP INDEX "Task_ownerId_idx";
ALTER TABLE "Task" DROP COLUMN "ownerId";
ALTER TABLE "Task" DROP COLUMN "assigneeLabel";
