-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'NETWORKING', 'ROADSHOW', 'OTHER');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "activeSequence" JSONB;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "location" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'OTHER',
    "attendeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goals" TEXT DEFAULT '',
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
