-- CreateTable
CREATE TABLE "NewCompanyDismissal" (
    "id" TEXT NOT NULL,
    "orgKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewCompanyDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewCompanyDismissal_orgKey_key" ON "NewCompanyDismissal"("orgKey");
