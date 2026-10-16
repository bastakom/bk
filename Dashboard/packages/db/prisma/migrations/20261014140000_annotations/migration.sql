-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "annotations_clientId_date_idx" ON "annotations"("clientId", "date");

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "clients"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Radnivåskydd som övriga tenant-tabeller.
ALTER TABLE "annotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "annotations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "annotations" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "annotations" TO rp_app;
