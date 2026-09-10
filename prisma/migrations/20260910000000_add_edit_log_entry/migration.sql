-- CreateTable
CREATE TABLE "EditLogEntry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "EditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditLogEntry_entityType_entityId_idx" ON "EditLogEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EditLogEntry_createdAt_idx" ON "EditLogEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "EditLogEntry" ADD CONSTRAINT "EditLogEntry_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
