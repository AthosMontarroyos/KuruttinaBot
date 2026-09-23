-- Dedicated ownership and read-only runtime roles. No runtime password is stored in migrations.
CREATE ROLE kuruttina_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE kuruttina_bot LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT kuruttina_owner TO CURRENT_USER;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $migration$
BEGIN
  EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kuruttina_bot', current_database());
END
$migration$;
ALTER ROLE kuruttina_bot SET search_path = pg_catalog, bot_private;
ALTER ROLE kuruttina_bot SET statement_timeout = '5s';
ALTER ROLE kuruttina_bot SET idle_in_transaction_session_timeout = '5s';
CREATE SCHEMA bot_private AUTHORIZATION kuruttina_owner;
REVOKE ALL ON SCHEMA bot_private FROM PUBLIC;
SET LOCAL ROLE kuruttina_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA bot_private REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bot_private REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE bot_private.bot_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  dev_guild_id text NOT NULL CHECK (dev_guild_id ~ '^[1-9][0-9]{16,19}$' AND dev_guild_id::numeric <= 18446744073709551615),
  environment text NOT NULL CHECK (environment IN ('development', 'production'))
);
CREATE TABLE bot_private.bot_staff (
  user_id text PRIMARY KEY CHECK (user_id ~ '^[1-9][0-9]{16,19}$' AND user_id::numeric <= 18446744073709551615),
  role text NOT NULL UNIQUE CHECK (role IN ('creator', 'dev')),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE bot_private.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.bot_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE bot_private.bot_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.bot_staff FORCE ROW LEVEL SECURITY;
CREATE POLICY settings_admin ON bot_private.bot_settings TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY staff_admin ON bot_private.bot_staff TO kuruttina_owner USING (true) WITH CHECK (true);
-- Settings are a single internal global row; runtime can read it to deploy and validate the environment.
CREATE POLICY settings_read ON bot_private.bot_settings FOR SELECT TO kuruttina_bot USING (true);
CREATE POLICY staff_self_read ON bot_private.bot_staff FOR SELECT TO kuruttina_bot USING (
  active AND user_id = current_setting('app.discord_user_id', true)
  AND EXISTS (
    SELECT 1 FROM bot_private.bot_settings AS settings
    WHERE settings.singleton = true AND settings.dev_guild_id = current_setting('app.guild_id', true)
  )
);
GRANT USAGE ON SCHEMA bot_private TO kuruttina_bot;
GRANT SELECT ON bot_private.bot_settings, bot_private.bot_staff TO kuruttina_bot;
RESET ROLE;
-- Supabase may install default grants for API roles; revoke any such table access explicitly.
DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA bot_private FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bot_private FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
