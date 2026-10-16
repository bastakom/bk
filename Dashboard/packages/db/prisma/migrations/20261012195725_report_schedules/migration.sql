-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PdfLayout" AS ENUM ('PAGED', 'LONG');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "weekday" INTEGER,
    "dayOfMonth" INTEGER,
    "hour" INTEGER NOT NULL DEFAULT 7,
    "timezone" TEXT NOT NULL,
    "rangePreset" TEXT NOT NULL,
    "compare" TEXT NOT NULL DEFAULT 'previous_period',
    "layout" "PdfLayout" NOT NULL DEFAULT 'PAGED',
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "message" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "error" TEXT,
    "provider" TEXT NOT NULL,
    "pdfPath" TEXT,
    "htmlPath" TEXT,
    "pageCount" INTEGER,
    "rangeLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_schedules_active_nextRunAt_idx" ON "report_schedules"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "report_schedules_dashboardId_idx" ON "report_schedules"("dashboardId");

-- CreateIndex
CREATE INDEX "report_deliveries_dashboardId_createdAt_idx" ON "report_deliveries"("dashboardId", "createdAt");

-- CreateIndex
CREATE INDEX "report_deliveries_workspaceId_createdAt_idx" ON "report_deliveries"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_dashboardId_clientId_fkey" FOREIGN KEY ("dashboardId", "clientId") REFERENCES "dashboards"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "report_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "report_schedules" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
ALTER TABLE "report_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "report_deliveries" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
