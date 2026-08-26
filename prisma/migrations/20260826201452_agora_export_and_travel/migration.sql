-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "agoraExportedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Travel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Travel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Travel_startDate_idx" ON "Travel"("startDate");

-- CreateIndex
CREATE INDEX "Travel_userId_idx" ON "Travel"("userId");

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
