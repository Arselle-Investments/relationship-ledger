-- CreateEnum
CREATE TYPE "RecordContext" AS ENUM ('FUND', 'DEAL');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "recordContext" "RecordContext";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "recordContext" "RecordContext";

-- CreateIndex
CREATE INDEX "Contact_recordContext_idx" ON "Contact"("recordContext");

-- CreateIndex
CREATE INDEX "Company_recordContext_idx" ON "Company"("recordContext");
