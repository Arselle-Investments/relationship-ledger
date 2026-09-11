-- Removes FOLLOW_UP_ENGAGEMENT from FundraisingStage. Its only two Contact
-- occupants (Eli Hsia, James Stanton) were already moved to DUE_DILIGENCE by
-- a prior data pass. DealFeedback.status and ContactStatusChange.toStatus
-- still had rows on this value (62 and 2 respectively) — remapped to
-- ACTIVE_PROSPECT, the closest remaining stage for "engaged, not yet in
-- diligence and not yet committed," before the value is dropped.

UPDATE "DealFeedback" SET "status" = 'ACTIVE_PROSPECT' WHERE "status" = 'FOLLOW_UP_ENGAGEMENT';
UPDATE "ContactStatusChange" SET "toStatus" = 'ACTIVE_PROSPECT' WHERE "toStatus" = 'FOLLOW_UP_ENGAGEMENT';
UPDATE "ContactStatusChange" SET "fromStatus" = 'ACTIVE_PROSPECT' WHERE "fromStatus" = 'FOLLOW_UP_ENGAGEMENT';

CREATE TYPE "FundraisingStage_new" AS ENUM ('NOT_STARTED', 'OUTREACH_SENT', 'INITIAL_INTEREST', 'MEETING_OCCURRED', 'ACTIVE_PROSPECT', 'DUE_DILIGENCE', 'COMMITTED', 'PASSED_OPEN', 'PASSED_NOT_INTERESTED', 'DO_NOT_CONTACT');

ALTER TABLE "Contact" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "status" TYPE "FundraisingStage_new" USING ("status"::text::"FundraisingStage_new");
ALTER TABLE "Contact" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

ALTER TABLE "DealFeedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DealFeedback" ALTER COLUMN "status" TYPE "FundraisingStage_new" USING ("status"::text::"FundraisingStage_new");
ALTER TABLE "DealFeedback" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" DROP DEFAULT;
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" TYPE "FundraisingStage_new" USING ("outreachStatus"::text::"FundraisingStage_new");
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" SET DEFAULT 'NOT_STARTED';

ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" DROP DEFAULT;
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" TYPE "FundraisingStage_new" USING ("outreachStatus"::text::"FundraisingStage_new");
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" SET DEFAULT 'NOT_STARTED';

ALTER TABLE "ContactStatusChange" ALTER COLUMN "fromStatus" TYPE "FundraisingStage_new" USING ("fromStatus"::text::"FundraisingStage_new");
ALTER TABLE "ContactStatusChange" ALTER COLUMN "toStatus" TYPE "FundraisingStage_new" USING ("toStatus"::text::"FundraisingStage_new");

ALTER TABLE "Correspondence" ALTER COLUMN "suggestedStatus" TYPE "FundraisingStage_new" USING ("suggestedStatus"::text::"FundraisingStage_new");

ALTER TABLE "MailingList" ALTER COLUMN "filterStatus" TYPE "FundraisingStage_new" USING ("filterStatus"::text::"FundraisingStage_new");

DROP TYPE "FundraisingStage";
ALTER TYPE "FundraisingStage_new" RENAME TO "FundraisingStage";
