-- AlterTable
ALTER TABLE "Conference" RENAME CONSTRAINT "Event_pkey" TO "Conference_pkey";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "closeProbability" INTEGER;

-- CreateTable
CREATE TABLE "ContactMergeDismissal" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMergeDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactMergeDismissal_groupKey_key" ON "ContactMergeDismissal"("groupKey");
