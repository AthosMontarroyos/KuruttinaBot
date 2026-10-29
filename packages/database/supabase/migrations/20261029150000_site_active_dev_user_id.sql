-- Leitura mínima para o DevMock do site: só o user_id do registro ativo com papel dev.
-- kuruttina_site não recebe SELECT em bot_staff (a linha creator e as demais colunas ficam ocultas).
-- A função é SECURITY DEFINER de kuruttina_owner (NOLOGIN), com search_path fixo.
-- A RLS de bot_staff permanece habilitada e forçada; o owner continua sujeito à policy staff_admin.
SET LOCAL ROLE kuruttina_owner;

CREATE FUNCTION bot_private.active_dev_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT staff.user_id
  FROM bot_private.bot_staff AS staff
  WHERE staff.role = 'dev' AND staff.active
$$;

REVOKE ALL ON FUNCTION bot_private.active_dev_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bot_private.active_dev_user_id() TO kuruttina_site;

RESET ROLE;

DO $migration$
DECLARE api_role text;
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION bot_private.active_dev_user_id() FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION bot_private.active_dev_user_id() FROM kuruttina_bot';
  EXECUTE 'REVOKE ALL ON TABLE bot_private.bot_staff FROM PUBLIC';
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION bot_private.active_dev_user_id() FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON TABLE bot_private.bot_staff FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
