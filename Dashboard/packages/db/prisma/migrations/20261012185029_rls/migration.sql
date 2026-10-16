-- Row level security: appen ansluter som rp_app (utan BYPASSRLS). Varje
-- tenant-tabell visar bara rader för den byrå som satts med
--   SELECT set_config('app.workspace_id', '<id>', true)
-- i den aktuella transaktionen (se withTenant() i src/index.ts).
-- Utan satt workspace syns ingenting – fel i appkoden läcker alltså inte data.

GRANT USAGE ON SCHEMA public TO rp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rp_app;

CREATE OR REPLACE FUNCTION app_workspace_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.workspace_id', true), '') $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'connections', 'connected_accounts', 'dashboards', 'widgets',
    'widget_sources', 'dashboard_templates', 'sync_runs', 'metric_facts', 'creatives'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("workspaceId" = app_workspace_id()) WITH CHECK ("workspaceId" = app_workspace_id())',
      t
    );
  END LOOP;
END $$;
