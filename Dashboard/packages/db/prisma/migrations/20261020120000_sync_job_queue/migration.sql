CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "sync_jobs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "dimension" TEXT NOT NULL,
  "rangeStart" DATE NOT NULL,
  "rangeEnd" DATE NOT NULL,
  "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "rowsWritten" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sync_jobs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sync_jobs_accountId_dimension_rangeStart_rangeEnd_key"
  ON "sync_jobs"("accountId", "dimension", "rangeStart", "rangeEnd");

CREATE INDEX "sync_jobs_queue_idx"
  ON "sync_jobs"("status", "runAfter", "lockedAt");

CREATE INDEX "sync_jobs_account_idx"
  ON "sync_jobs"("accountId", "status", "rangeStart");
