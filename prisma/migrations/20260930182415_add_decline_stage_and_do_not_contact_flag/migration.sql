-- Add the new DECLINE value to FundraisingStage (additive, non-breaking).
-- Existing rows on PASSED_NOT_INTERESTED / DO_NOT_CONTACT are migrated to it
-- in a follow-up data-migration step, then those two values are retired in a
-- later migration once nothing references them anymore.
ALTER TYPE "FundraisingStage" ADD VALUE 'DECLINE';

-- Independent "never contact again" compliance/preference flag, separate
-- from pipeline stage. See Contact.doNotContact comment in schema.prisma.
ALTER TABLE "Contact" ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false;
