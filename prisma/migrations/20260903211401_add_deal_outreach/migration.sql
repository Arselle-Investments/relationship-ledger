-- CreateTable
CREATE TABLE "DealOutreach" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealOutreach_companyId_idx" ON "DealOutreach"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DealOutreach_dealId_companyId_key" ON "DealOutreach"("dealId", "companyId");

-- AddForeignKey
ALTER TABLE "DealOutreach" ADD CONSTRAINT "DealOutreach_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealOutreach" ADD CONSTRAINT "DealOutreach_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
