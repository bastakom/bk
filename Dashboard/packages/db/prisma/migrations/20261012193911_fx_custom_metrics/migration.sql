-- CreateEnum
CREATE TYPE "MetricFormat" AS ENUM ('number', 'currency', 'percent', 'duration');

-- CreateTable
CREATE TABLE "fx_rates" (
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "perEur" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ECB',

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("currency","date")
);

-- CreateTable
CREATE TABLE "custom_metrics" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "format" "MetricFormat" NOT NULL DEFAULT 'number',
    "higherIsBetter" BOOLEAN,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_metrics_workspaceId_key_key" ON "custom_metrics"("workspaceId", "key");

-- AddForeignKey
ALTER TABLE "custom_metrics" ADD CONSTRAINT "custom_metrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Egna metrics är byråns data: samma radisolering som övriga tenant-tabeller.
ALTER TABLE "custom_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_metrics" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "custom_metrics" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());

-- Valutakurser är globala och skrivs bara av systemjobb (ägarrollen).
REVOKE INSERT, UPDATE, DELETE ON "fx_rates" FROM rp_app;
GRANT SELECT ON "fx_rates" TO rp_app;
