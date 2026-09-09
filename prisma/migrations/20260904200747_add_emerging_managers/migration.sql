-- AlterTable
ALTER TABLE "Correspondence" ADD COLUMN     "capitalSourceId" TEXT,
ADD COLUMN     "consultantId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "dateConfidence" TEXT,
ADD COLUMN     "fitNote" TEXT,
ADD COLUMN     "lastRefreshedAt" TIMESTAMP(3),
ADD COLUMN     "organizer" TEXT,
ADD COLUMN     "registrationLink" TEXT,
ADD COLUMN     "registrationOpensAt" DATE,
ADD COLUMN     "registrationStatus" TEXT,
ADD COLUMN     "tier" INTEGER;

-- CreateTable
CREATE TABLE "Consultant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capitalSourcesCoveredNote" TEXT DEFAULT '',
    "intakeProcess" TEXT DEFAULT '',
    "knownContacts" TEXT DEFAULT '',
    "nextStep" TEXT DEFAULT '',
    "outreachStatus" "ContactStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "verificationNotes" TEXT DEFAULT '',
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "outreachStatus" "ContactStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "nextStep" TEXT DEFAULT '',
    "timing" TEXT,
    "consultantId" TEXT,
    "programManager" TEXT,
    "overview" TEXT DEFAULT '',
    "openDoorPolicy" TEXT DEFAULT '',
    "minimumFundSize" TEXT,
    "typicalCheckSize" TEXT,
    "keyContact" TEXT DEFAULT '',
    "emailsWebsites" TEXT DEFAULT '',
    "timeline" TEXT,
    "capitalStatus" TEXT,
    "redFlags" TEXT DEFAULT '',
    "arselleFit" TEXT DEFAULT '',
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consultant_name_key" ON "Consultant"("name");

-- CreateIndex
CREATE INDEX "Consultant_outreachStatus_idx" ON "Consultant"("outreachStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalSource_name_key" ON "CapitalSource"("name");

-- CreateIndex
CREATE INDEX "CapitalSource_outreachStatus_idx" ON "CapitalSource"("outreachStatus");

-- CreateIndex
CREATE INDEX "CapitalSource_consultantId_idx" ON "CapitalSource"("consultantId");

-- CreateIndex
CREATE INDEX "Correspondence_capitalSourceId_idx" ON "Correspondence"("capitalSourceId");

-- CreateIndex
CREATE INDEX "Correspondence_consultantId_idx" ON "Correspondence"("consultantId");

-- AddForeignKey
ALTER TABLE "CapitalSource" ADD CONSTRAINT "CapitalSource_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_capitalSourceId_fkey" FOREIGN KEY ("capitalSourceId") REFERENCES "CapitalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondence" ADD CONSTRAINT "Correspondence_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
