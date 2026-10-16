-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "metric" TEXT,
    "op" TEXT,
    "threshold" DOUBLE PRECISION,
    "window" TEXT NOT NULL DEFAULT 'last_7',
    "goalId" TEXT,
    "accountIds" TEXT[],
    "recipientIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firing" BOOLEAN NOT NULL DEFAULT false,
    "lastValue" DOUBLE PRECISION,
    "lastCheckedAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rules_clientId_idx" ON "alert_rules"("clientId");

-- CreateIndex
CREATE INDEX "alert_rules_active_lastCheckedAt_idx" ON "alert_rules"("active", "lastCheckedAt");

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "clients"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Radnivåskydd som övriga tenant-tabeller.
ALTER TABLE "alert_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alert_rules" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "alert_rules" TO rp_app;
