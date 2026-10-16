-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "allowDateChange" BOOLEAN NOT NULL DEFAULT true,
    "allowPdf" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_dashboardId_idx" ON "share_links"("dashboardId");

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_dashboardId_clientId_fkey" FOREIGN KEY ("dashboardId", "clientId") REFERENCES "dashboards"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "share_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "share_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "share_links" USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id());

-- Publika delningssidor vet inte vilken byrå länken hör till. Den här funktionen
-- slår upp exakt en giltig länk via dess token och returnerar bara det som behövs
-- för att därefter sätta byrån (RLS) – inga andra rader kan läsas på det här sättet.
CREATE OR REPLACE FUNCTION share_link_by_token(p_token text)
RETURNS TABLE (id text, "workspaceId" text, "dashboardId" text, "passwordHash" text, "expiresAt" timestamp(3), "allowDateChange" boolean, "allowPdf" boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, "workspaceId", "dashboardId", "passwordHash", "expiresAt", "allowDateChange", "allowPdf"
  FROM share_links
  WHERE token = p_token AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > now())
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION share_link_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION share_link_by_token(text) TO rp_app;
