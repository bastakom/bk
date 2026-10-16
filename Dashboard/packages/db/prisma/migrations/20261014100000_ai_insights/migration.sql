-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "brief" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "compareStart" DATE,
    "compareEnd" DATE,
    "model" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_insights_dashboardId_createdAt_idx" ON "ai_insights"("dashboardId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "clients"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_dashboardId_clientId_fkey" FOREIGN KEY ("dashboardId", "clientId") REFERENCES "dashboards"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Radnivåskydd som övriga tenant-tabeller.
ALTER TABLE "ai_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_insights" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_insights" TO rp_app;
