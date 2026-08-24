-- CreateEnum
CREATE TYPE "StageChangeSource" AS ENUM ('MANUAL', 'AI_SUGGESTED');

-- CreateTable
CREATE TABLE "ContactStatusChange" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fromStatus" "ContactStatus",
    "toStatus" "ContactStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "source" "StageChangeSource" NOT NULL DEFAULT 'MANUAL',
    "changedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactStatusChange_contactId_idx" ON "ContactStatusChange"("contactId");

-- CreateIndex
CREATE INDEX "ContactStatusChange_toStatus_idx" ON "ContactStatusChange"("toStatus");

-- AddForeignKey
ALTER TABLE "ContactStatusChange" ADD CONSTRAINT "ContactStatusChange_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
