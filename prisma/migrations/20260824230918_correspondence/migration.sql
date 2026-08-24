-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('MATCHED', 'SUGGESTED', 'IGNORED');

-- CreateTable
CREATE TABLE "Correspondence" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'teams_channel',
    "externalId" TEXT,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "extractedName" TEXT,
    "extractedEmail" TEXT,
    "extractedOrg" TEXT,
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Correspondence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Correspondence_externalId_key" ON "Correspondence"("externalId");

-- CreateIndex
CREATE INDEX "Correspondence_contactId_idx" ON "Correspondence"("contactId");

-- CreateIndex
CREATE INDEX "Correspondence_status_idx" ON "Correspondence"("status");

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
