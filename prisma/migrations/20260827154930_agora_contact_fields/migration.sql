-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "agoraRaw" JSONB,
ADD COLUMN     "agoraType" TEXT,
ADD COLUMN     "commitmentHigh" DOUBLE PRECISION,
ADD COLUMN     "commitmentLow" DOUBLE PRECISION,
ADD COLUMN     "emailTier" INTEGER,
ADD COLUMN     "primaryLocation" TEXT,
ADD COLUMN     "staffNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Contact_agoraType_idx" ON "Contact"("agoraType");

-- CreateIndex
CREATE INDEX "Contact_primaryLocation_idx" ON "Contact"("primaryLocation");
