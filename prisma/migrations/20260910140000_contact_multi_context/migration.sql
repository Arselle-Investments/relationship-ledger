-- Add the new multi-value column
ALTER TABLE "Contact" ADD COLUMN "recordContexts" "RecordContext"[] NOT NULL DEFAULT '{}';

-- Backfill from the old single-value column
UPDATE "Contact" SET "recordContexts" = ARRAY["recordContext"] WHERE "recordContext" IS NOT NULL;

-- Drop the old single-value column and its index
DROP INDEX IF EXISTS "Contact_recordContext_idx";
ALTER TABLE "Contact" DROP COLUMN "recordContext";
