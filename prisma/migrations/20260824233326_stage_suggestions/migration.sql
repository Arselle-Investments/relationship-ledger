-- CreateEnum
CREATE TYPE "SuggestionState" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "suggestedStatus" "ContactStatus",
ADD COLUMN     "suggestionRationale" TEXT,
ADD COLUMN     "suggestionState" "SuggestionState" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "Correspondence_suggestionState_idx" ON "Correspondence"("suggestionState");
