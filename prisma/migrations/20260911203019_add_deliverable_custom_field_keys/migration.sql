-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "customFieldKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
