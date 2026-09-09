-- Provenance tracking (which upstream export(s) contributed to this record)
-- plus a handful of fields that recur across sources often enough to be
-- worth promoting out of the free-text notes blob.
ALTER TABLE "Company" ADD COLUMN "sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Company" ADD COLUMN "website" TEXT;
ALTER TABLE "Company" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN "aum" TEXT;
ALTER TABLE "Company" ADD COLUMN "founded" TEXT;
