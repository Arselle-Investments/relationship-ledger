-- CreateTable
CREATE TABLE "AgoraExportLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgoraExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgoraExportLog_kind_createdAt_idx" ON "AgoraExportLog"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "AgoraExportLog" ADD CONSTRAINT "AgoraExportLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
