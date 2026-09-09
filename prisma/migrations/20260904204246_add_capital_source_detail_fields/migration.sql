-- AlterTable
ALTER TABLE "CapitalSource" ADD COLUMN     "actionPlanSource" TEXT DEFAULT '',
ADD COLUMN     "actionability" TEXT DEFAULT '',
ADD COLUMN     "capitalStatusSource" TEXT DEFAULT '',
ADD COLUMN     "consultantSource" TEXT DEFAULT '',
ADD COLUMN     "knownCommitmentsCompetitors" TEXT DEFAULT '',
ADD COLUMN     "knownCommitmentsOperators" TEXT DEFAULT '',
ADD COLUMN     "minimumFundSizeSource" TEXT DEFAULT '',
ADD COLUMN     "typicalCheckSizeSource" TEXT DEFAULT '';
