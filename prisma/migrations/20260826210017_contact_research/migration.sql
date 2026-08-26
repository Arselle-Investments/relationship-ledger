-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "researchBio" TEXT,
ADD COLUMN     "researchBioSource" TEXT,
ADD COLUMN     "researchNews" JSONB,
ADD COLUMN     "researchUpdatedAt" TIMESTAMP(3);
