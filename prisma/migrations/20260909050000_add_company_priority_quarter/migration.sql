-- Additive, nullable column: Company joins Contact in the Priorities
-- (Tier x Quarter) matrix.
ALTER TABLE "Company" ADD COLUMN "priorityQuarter" TEXT;
