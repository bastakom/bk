-- AlterTable
ALTER TABLE "connected_accounts" ADD COLUMN     "syncLockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sync_alerts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "AccountStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_alerts_workspaceId_createdAt_idx" ON "sync_alerts"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "sync_alerts_accountId_resolvedAt_idx" ON "sync_alerts"("accountId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "sync_alerts" ADD CONSTRAINT "sync_alerts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sync_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_alerts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sync_alerts" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
