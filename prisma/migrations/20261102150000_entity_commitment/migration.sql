-- EntityCommitment: the estimated commitment amount per investor (investing
-- entity, or company when none is set) shown in the AREF I funnel. New table
-- only; no existing data is touched.
CREATE TABLE "EntityCommitment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityCommitment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntityCommitment_key_key" ON "EntityCommitment"("key");
