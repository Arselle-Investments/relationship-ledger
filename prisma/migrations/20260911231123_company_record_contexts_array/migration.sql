-- Convert Company.recordContext (single, nullable) to recordContexts (array),
-- preserving existing data: NULL -> {}, a single value -> a one-element array.
ALTER TABLE "Company" ADD COLUMN "recordContexts" "RecordContext"[] NOT NULL DEFAULT '{}';

UPDATE "Company"
SET "recordContexts" = ARRAY["recordContext"]::"RecordContext"[]
WHERE "recordContext" IS NOT NULL;

DROP INDEX IF EXISTS "Company_recordContext_idx";
ALTER TABLE "Company" DROP COLUMN "recordContext";
