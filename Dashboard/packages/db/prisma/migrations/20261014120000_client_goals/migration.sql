-- CreateTable
CREATE TABLE "client_goals" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "accountIds" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_goals_clientId_idx" ON "client_goals"("clientId");

-- AddForeignKey
ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "clients"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Radnivåskydd som övriga tenant-tabeller.
ALTER TABLE "client_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_goals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "client_goals" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_goals" TO rp_app;
