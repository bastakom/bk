-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "dashboards" ADD COLUMN     "inPortal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "clientIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "clientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_workspaceId_idx" ON "invitations"("workspaceId");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Behörighet per kund. withTenant() sätter app.client_ids till en kommaseparerad
-- lista för användare som bara får se vissa kunder (osatt = alla byråns kunder).
-- Policyerna är RESTRICTIVE, så de gäller utöver byråisoleringen.
CREATE OR REPLACE FUNCTION app_client_allowed(cid text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT COALESCE(current_setting('app.client_ids', true), '') = ''
        OR cid = ANY (string_to_array(current_setting('app.client_ids', true), ','))
  $$;

CREATE POLICY client_access ON "clients" AS RESTRICTIVE USING (app_client_allowed("id")) WITH CHECK (app_client_allowed("id"));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dashboards', 'widgets', 'widget_sources', 'client_sources', 'share_links', 'report_schedules',
    'report_deliveries', 'ai_insights', 'client_goals', 'annotations', 'alert_rules'
  ] LOOP
    EXECUTE format('CREATE POLICY client_access ON %I AS RESTRICTIVE USING (app_client_allowed("clientId")) WITH CHECK (app_client_allowed("clientId"))', t);
  END LOOP;
END $$;
