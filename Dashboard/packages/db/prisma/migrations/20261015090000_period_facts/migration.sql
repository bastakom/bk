-- CreateTable
CREATE TABLE "period_facts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "filterKey" TEXT NOT NULL DEFAULT '',
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "rows" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_facts_accountId_dimension_filterKey_start_end_key" ON "period_facts"("accountId", "dimension", "filterKey", "start", "end");

-- AddForeignKey
ALTER TABLE "period_facts" ADD CONSTRAINT "period_facts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Radnivåskydd som övriga tenant-tabeller.
ALTER TABLE "period_facts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "period_facts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "period_facts" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "period_facts" TO rp_app;
