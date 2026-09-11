-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "status" "FundraisingStage" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "CompanyStatusChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromStatus" "FundraisingStage",
    "toStatus" "FundraisingStage" NOT NULL,
    "note" TEXT NOT NULL,
    "source" "StageChangeSource" NOT NULL DEFAULT 'MANUAL',
    "changedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyStatusChange_companyId_idx" ON "CompanyStatusChange"("companyId");

-- CreateIndex
CREATE INDEX "CompanyStatusChange_toStatus_idx" ON "CompanyStatusChange"("toStatus");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- AddForeignKey
ALTER TABLE "CompanyStatusChange" ADD CONSTRAINT "CompanyStatusChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
