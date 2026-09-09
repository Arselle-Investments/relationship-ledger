-- CreateTable
CREATE TABLE "CompanyMergeDismissal" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMergeDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMergeDismissal_groupKey_key" ON "CompanyMergeDismissal"("groupKey");
