-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('ACTIVE', 'DEAD', 'DORMANT');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('INTERESTED', 'REVIEWING', 'PASSED', 'DECLINED', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('MANUAL', 'CORRESPONDENCE');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'OTHER',
    "tier" "ContactTier",
    "city" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT DEFAULT '',
    "targetAssetClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "investmentStructures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "investmentStrategies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "investmentSizeMin" DOUBLE PRECISION,
    "investmentSizeMax" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'ACTIVE',
    "assetClass" TEXT,
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFeedback" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT NOT NULL,
    "source" "FeedbackSource" NOT NULL DEFAULT 'MANUAL',
    "correspondenceId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Deal_status_idx" ON "Deal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DealFeedback_correspondenceId_key" ON "DealFeedback"("correspondenceId");

-- CreateIndex
CREATE INDEX "DealFeedback_dealId_idx" ON "DealFeedback"("dealId");

-- CreateIndex
CREATE INDEX "DealFeedback_companyId_idx" ON "DealFeedback"("companyId");

-- CreateIndex
CREATE INDEX "DealFeedback_contactId_idx" ON "DealFeedback"("contactId");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_correspondenceId_fkey" FOREIGN KEY ("correspondenceId") REFERENCES "Correspondence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
