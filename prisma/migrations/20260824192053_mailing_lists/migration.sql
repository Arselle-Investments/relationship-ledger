-- CreateEnum
CREATE TYPE "MailingListMode" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateTable
CREATE TABLE "MailingList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "MailingListMode" NOT NULL DEFAULT 'STATIC',
    "contactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterType" "ContactType",
    "filterTier" "ContactTier",
    "filterOwnerId" TEXT,
    "filterTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailingList_pkey" PRIMARY KEY ("id")
);
