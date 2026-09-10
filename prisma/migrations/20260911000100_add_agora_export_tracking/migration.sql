-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "agoraChangesSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "agoraExportedAt" TIMESTAMP(3);
