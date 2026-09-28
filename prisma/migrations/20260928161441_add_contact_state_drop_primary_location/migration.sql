-- DropIndex
DROP INDEX "Contact_primaryLocation_idx";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "state" TEXT;
ALTER TABLE "Contact" DROP COLUMN "primaryLocation";

-- CreateIndex
CREATE INDEX "Contact_state_idx" ON "Contact"("state");
