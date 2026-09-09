-- Moves Consultant/CapitalSource.outreachStatus off the EM-only ContactStatus
-- enum onto FundraisingStage, the same stage vocabulary Contact and
-- DealFeedback use, now that Emerging Managers is getting real correspondence
-- and stage tracking of its own. Same data-preserving mapping used for
-- Contact's original migration (see 20260909012737_revise_fundraising_stages).

-- Consultant.outreachStatus
ALTER TABLE "Consultant" ADD COLUMN "outreachStatus_new" "FundraisingStage";
UPDATE "Consultant" SET "outreachStatus_new" = CASE "outreachStatus"::text
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'OUTREACH_SENT' THEN 'OUTREACH_SENT'
  WHEN 'AWAITING_REPLY' THEN 'OUTREACH_SENT'
  WHEN 'RESPONDED' THEN 'INITIAL_INTEREST'
  WHEN 'MEETING_SCHEDULED' THEN 'MEETING_OCCURRED'
  WHEN 'DILIGENCE' THEN 'DUE_DILIGENCE'
  WHEN 'COMMITTED' THEN 'COMMITTED'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
END::"FundraisingStage";
DROP INDEX IF EXISTS "Consultant_outreachStatus_idx";
ALTER TABLE "Consultant" DROP COLUMN "outreachStatus";
ALTER TABLE "Consultant" RENAME COLUMN "outreachStatus_new" TO "outreachStatus";
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" SET NOT NULL;
CREATE INDEX "Consultant_outreachStatus_idx" ON "Consultant"("outreachStatus");

-- CapitalSource.outreachStatus
ALTER TABLE "CapitalSource" ADD COLUMN "outreachStatus_new" "FundraisingStage";
UPDATE "CapitalSource" SET "outreachStatus_new" = CASE "outreachStatus"::text
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'OUTREACH_SENT' THEN 'OUTREACH_SENT'
  WHEN 'AWAITING_REPLY' THEN 'OUTREACH_SENT'
  WHEN 'RESPONDED' THEN 'INITIAL_INTEREST'
  WHEN 'MEETING_SCHEDULED' THEN 'MEETING_OCCURRED'
  WHEN 'DILIGENCE' THEN 'DUE_DILIGENCE'
  WHEN 'COMMITTED' THEN 'COMMITTED'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
END::"FundraisingStage";
DROP INDEX IF EXISTS "CapitalSource_outreachStatus_idx";
ALTER TABLE "CapitalSource" DROP COLUMN "outreachStatus";
ALTER TABLE "CapitalSource" RENAME COLUMN "outreachStatus_new" TO "outreachStatus";
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" SET NOT NULL;
CREATE INDEX "CapitalSource_outreachStatus_idx" ON "CapitalSource"("outreachStatus");

-- ContactStatus is no longer referenced by any column
DROP TYPE "ContactStatus";
