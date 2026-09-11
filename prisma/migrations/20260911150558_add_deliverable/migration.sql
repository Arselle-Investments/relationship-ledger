-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagMatches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);
