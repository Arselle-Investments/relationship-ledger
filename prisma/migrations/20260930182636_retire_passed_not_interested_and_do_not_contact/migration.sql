-- AlterEnum
-- Retires PASSED_NOT_INTERESTED and DO_NOT_CONTACT from FundraisingStage, now
-- that every row referencing them has been migrated to DECLINE (Contact,
-- Company, DealFeedback, Consultant/CapitalSource outreachStatus,
-- Correspondence.suggestedStatus, ContactStatusChange/CompanyStatusChange
-- from/toStatus, MailingList.filterStatus). See schema.prisma's
-- FundraisingStage comment for why.
BEGIN;
CREATE TYPE "FundraisingStage_new" AS ENUM ('NOT_STARTED', 'OUTREACH_SENT', 'INITIAL_INTEREST', 'MEETING_OCCURRED', 'ACTIVE_PROSPECT', 'FINAL_CLOSE_POTENTIAL', 'DUE_DILIGENCE', 'COMMITTED', 'PASSED_OPEN', 'DECLINE');
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DealFeedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "status" TYPE "FundraisingStage_new" USING ("status"::text::"FundraisingStage_new");
ALTER TABLE "Company" ALTER COLUMN "status" TYPE "FundraisingStage_new" USING ("status"::text::"FundraisingStage_new");
ALTER TABLE "CompanyStatusChange" ALTER COLUMN "fromStatus" TYPE "FundraisingStage_new" USING ("fromStatus"::text::"FundraisingStage_new");
ALTER TABLE "CompanyStatusChange" ALTER COLUMN "toStatus" TYPE "FundraisingStage_new" USING ("toStatus"::text::"FundraisingStage_new");
ALTER TABLE "DealFeedback" ALTER COLUMN "status" TYPE "FundraisingStage_new" USING ("status"::text::"FundraisingStage_new");
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" TYPE "FundraisingStage_new" USING ("outreachStatus"::text::"FundraisingStage_new");
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" TYPE "FundraisingStage_new" USING ("outreachStatus"::text::"FundraisingStage_new");
ALTER TABLE "ContactStatusChange" ALTER COLUMN "fromStatus" TYPE "FundraisingStage_new" USING ("fromStatus"::text::"FundraisingStage_new");
ALTER TABLE "ContactStatusChange" ALTER COLUMN "toStatus" TYPE "FundraisingStage_new" USING ("toStatus"::text::"FundraisingStage_new");
ALTER TABLE "Correspondence" ALTER COLUMN "suggestedStatus" TYPE "FundraisingStage_new" USING ("suggestedStatus"::text::"FundraisingStage_new");
ALTER TABLE "MailingList" ALTER COLUMN "filterStatus" TYPE "FundraisingStage_new" USING ("filterStatus"::text::"FundraisingStage_new");
ALTER TYPE "FundraisingStage" RENAME TO "FundraisingStage_old";
ALTER TYPE "FundraisingStage_new" RENAME TO "FundraisingStage";
DROP TYPE "FundraisingStage_old";
ALTER TABLE "CapitalSource" ALTER COLUMN "outreachStatus" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "Company" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "Consultant" ALTER COLUMN "outreachStatus" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "Contact" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "DealFeedback" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
COMMIT;
