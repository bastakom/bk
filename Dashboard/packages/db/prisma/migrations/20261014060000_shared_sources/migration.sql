-- Byråns databaser: ett konto (källa) finns en gång per byrå och kan väljas av
-- flera kunder via client_sources. Data (fakta, annonser, synk, larm) hör till
-- källan, inte till en kund, och hämtas därför bara en gång.

-- 1. Kundernas val av källor, med filter som avgränsar kundens del.
CREATE TABLE "client_sources" (
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_sources_pkey" PRIMARY KEY ("clientId","accountId")
);
CREATE INDEX "client_sources_accountId_idx" ON "client_sources"("accountId");

-- 2. Befintliga kopplingar blir kundens val (inga filter: kunden ser allt som förut).
INSERT INTO "client_sources" ("workspaceId", "clientId", "accountId", "createdAt")
SELECT "workspaceId", "clientId", "id", "createdAt" FROM "connected_accounts";

-- 3. Widgetkällor pekar på kundens val i stället för direkt på kontot.
ALTER TABLE "widget_sources" DROP CONSTRAINT "widget_sources_accountId_clientId_fkey";

-- 4. Kontot och dess data bär inte längre någon kund.
DROP INDEX "connected_accounts_clientId_idx";
DROP INDEX "connected_accounts_id_clientId_key";
DROP INDEX "metric_facts_clientId_date_idx";
ALTER TABLE "connected_accounts" DROP CONSTRAINT IF EXISTS "connected_accounts_clientId_workspaceId_fkey";
ALTER TABLE "connected_accounts" DROP COLUMN "clientId";
ALTER TABLE "creatives" DROP COLUMN "clientId";
ALTER TABLE "metric_facts" DROP COLUMN "clientId";
ALTER TABLE "sync_alerts" DROP COLUMN "clientId";
CREATE INDEX "connected_accounts_connectionId_idx" ON "connected_accounts"("connectionId");

-- 5. Främmande nycklar.
ALTER TABLE "client_sources" ADD CONSTRAINT "client_sources_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "clients"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_sources" ADD CONSTRAINT "client_sources_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "widget_sources" ADD CONSTRAINT "widget_sources_clientId_accountId_fkey" FOREIGN KEY ("clientId", "accountId") REFERENCES "client_sources"("clientId", "accountId") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Radnivåskydd som övriga tenant-tabeller.
ALTER TABLE "client_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_sources" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "client_sources" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_sources" TO rp_app;
