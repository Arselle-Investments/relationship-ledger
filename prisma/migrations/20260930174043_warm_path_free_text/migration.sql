-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_warmPathId_fkey";

-- AlterTable: warmPath is now free text (an external intermediary/broker),
-- not a link to a team-member User. No existing rows had this set.
ALTER TABLE "Contact" RENAME COLUMN "warmPathId" TO "warmPath";
