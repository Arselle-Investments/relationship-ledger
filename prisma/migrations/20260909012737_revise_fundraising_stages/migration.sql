-- Introduces FundraisingStage, a dedicated pipeline for Contact and
-- DealFeedback (LP/company-level), replacing the stages both used to borrow
-- from ContactStatus/FeedbackStatus. ContactStatus itself is untouched and
-- keeps serving Consultant/CapitalSource (Emerging Managers) outreach
-- tracking exactly as before — a deliberately separate, simpler pipeline.
--
-- Mapping applied to existing data (verified against every value actually in
-- use before writing this migration):
--   NOT_STARTED -> NOT_STARTED
--   OUTREACH_SENT -> OUTREACH_SENT
--   AWAITING_REPLY -> OUTREACH_SENT        (stage removed, folds into sent)
--   RESPONDED -> INITIAL_INTEREST
--   MEETING_SCHEDULED -> MEETING_OCCURRED
--   DILIGENCE -> DUE_DILIGENCE
--   COMMITTED -> COMMITTED
--   PASSED -> PASSED_OPEN                  (old data didn't distinguish; see
--                                            the data-hygiene follow-up pass)
--   (DealFeedback only) INTERESTED -> INITIAL_INTEREST
--   (DealFeedback only) REVIEWING -> FOLLOW_UP_ENGAGEMENT
--   (DealFeedback only) DECLINED -> PASSED_NOT_INTERESTED
--   (DealFeedback only) OTHER -> FOLLOW_UP_ENGAGEMENT

CREATE TYPE "FundraisingStage" AS ENUM ('NOT_STARTED', 'OUTREACH_SENT', 'INITIAL_INTEREST', 'MEETING_OCCURRED', 'FOLLOW_UP_ENGAGEMENT', 'DUE_DILIGENCE', 'COMMITTED', 'PASSED_OPEN', 'PASSED_NOT_INTERESTED');

-- Contact.status
ALTER TABLE "Contact" ADD COLUMN "status_new" "FundraisingStage";
UPDATE "Contact" SET "status_new" = CASE "status"::text
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'OUTREACH_SENT' THEN 'OUTREACH_SENT'
  WHEN 'AWAITING_REPLY' THEN 'OUTREACH_SENT'
  WHEN 'RESPONDED' THEN 'INITIAL_INTEREST'
  WHEN 'MEETING_SCHEDULED' THEN 'MEETING_OCCURRED'
  WHEN 'DILIGENCE' THEN 'DUE_DILIGENCE'
  WHEN 'COMMITTED' THEN 'COMMITTED'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
END::"FundraisingStage";
DROP INDEX IF EXISTS "Contact_status_idx";
ALTER TABLE "Contact" DROP COLUMN "status";
ALTER TABLE "Contact" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Contact" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "Contact" ALTER COLUMN "status" SET NOT NULL;
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- ContactStatusChange.fromStatus (nullable)
ALTER TABLE "ContactStatusChange" ADD COLUMN "fromStatus_new" "FundraisingStage";
UPDATE "ContactStatusChange" SET "fromStatus_new" = CASE "fromStatus"::text
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'OUTREACH_SENT' THEN 'OUTREACH_SENT'
  WHEN 'AWAITING_REPLY' THEN 'OUTREACH_SENT'
  WHEN 'RESPONDED' THEN 'INITIAL_INTEREST'
  WHEN 'MEETING_SCHEDULED' THEN 'MEETING_OCCURRED'
  WHEN 'DILIGENCE' THEN 'DUE_DILIGENCE'
  WHEN 'COMMITTED' THEN 'COMMITTED'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
  ELSE NULL
END::"FundraisingStage";
ALTER TABLE "ContactStatusChange" DROP COLUMN "fromStatus";
ALTER TABLE "ContactStatusChange" RENAME COLUMN "fromStatus_new" TO "fromStatus";

-- ContactStatusChange.toStatus (required)
ALTER TABLE "ContactStatusChange" ADD COLUMN "toStatus_new" "FundraisingStage";
UPDATE "ContactStatusChange" SET "toStatus_new" = CASE "toStatus"::text
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'OUTREACH_SENT' THEN 'OUTREACH_SENT'
  WHEN 'AWAITING_REPLY' THEN 'OUTREACH_SENT'
  WHEN 'RESPONDED' THEN 'INITIAL_INTEREST'
  WHEN 'MEETING_SCHEDULED' THEN 'MEETING_OCCURRED'
  WHEN 'DILIGENCE' THEN 'DUE_DILIGENCE'
  WHEN 'COMMITTED' THEN 'COMMITTED'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
END::"FundraisingStage";
DROP INDEX IF EXISTS "ContactStatusChange_toStatus_idx";
ALTER TABLE "ContactStatusChange" DROP COLUMN "toStatus";
ALTER TABLE "ContactStatusChange" RENAME COLUMN "toStatus_new" TO "toStatus";
ALTER TABLE "ContactStatusChange" ALTER COLUMN "toStatus" SET NOT NULL;
CREATE INDEX "ContactStatusChange_toStatus_idx" ON "ContactStatusChange"("toStatus");

-- Correspondence.suggestedStatus (nullable)
ALTER TABLE "Correspondence" ADD COLUMN "suggestedStatus_new" "FundraisingStage";
UPDATE "Correspondence" SET "suggestedStatus_new" = CASE "suggestedStatus"::text
  WHEN 'NOT_STARTED' THEN 'NOT_STARTED'
  WHEN 'OUTREACH_SENT' THEN 'OUTREACH_SENT'
  WHEN 'AWAITING_REPLY' THEN 'OUTREACH_SENT'
  WHEN 'RESPONDED' THEN 'INITIAL_INTEREST'
  WHEN 'MEETING_SCHEDULED' THEN 'MEETING_OCCURRED'
  WHEN 'DILIGENCE' THEN 'DUE_DILIGENCE'
  WHEN 'COMMITTED' THEN 'COMMITTED'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
  ELSE NULL
END::"FundraisingStage";
ALTER TABLE "Correspondence" DROP COLUMN "suggestedStatus";
ALTER TABLE "Correspondence" RENAME COLUMN "suggestedStatus_new" TO "suggestedStatus";

-- DealFeedback.status (FeedbackStatus -> FundraisingStage)
ALTER TABLE "DealFeedback" ADD COLUMN "status_new" "FundraisingStage";
UPDATE "DealFeedback" SET "status_new" = CASE "status"::text
  WHEN 'INTERESTED' THEN 'INITIAL_INTEREST'
  WHEN 'REVIEWING' THEN 'FOLLOW_UP_ENGAGEMENT'
  WHEN 'PASSED' THEN 'PASSED_OPEN'
  WHEN 'DECLINED' THEN 'PASSED_NOT_INTERESTED'
  WHEN 'OTHER' THEN 'FOLLOW_UP_ENGAGEMENT'
END::"FundraisingStage";
ALTER TABLE "DealFeedback" DROP COLUMN "status";
ALTER TABLE "DealFeedback" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "DealFeedback" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "DealFeedback" ALTER COLUMN "status" SET NOT NULL;

-- FeedbackStatus is no longer referenced by any column
DROP TYPE "FeedbackStatus";
