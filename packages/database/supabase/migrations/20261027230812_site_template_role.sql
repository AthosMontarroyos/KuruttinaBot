-- Role de runtime própria do site (painel de configuração do servidor), separada
-- de `kuruttina_bot`: a regra de privilégios mínimos do projeto exige roles
-- distintas quando as capacidades diferem. O site só administra templates de
-- mensagem a pedido de um admin autenticado; nunca lê Gateway, nunca lê
-- `bot_settings`/`bot_staff`, e não herda nada de `kuruttina_bot`.
CREATE ROLE kuruttina_site LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
DO $migration$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kuruttina_site', current_database());
END
$migration$;
ALTER ROLE kuruttina_site SET search_path = pg_catalog, bot_private;
ALTER ROLE kuruttina_site SET statement_timeout = '5s';
ALTER ROLE kuruttina_site SET idle_in_transaction_session_timeout = '5s';

SET LOCAL ROLE kuruttina_owner;
GRANT USAGE ON SCHEMA bot_private TO kuruttina_site;
GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.message_templates TO kuruttina_site;
GRANT USAGE ON SEQUENCE bot_private.message_templates_id_seq TO kuruttina_site;
-- Mesmas políticas de `kuruttina_bot`: isolamento por `guild_id`, uma operação por policy.
-- `kuruttina_site` nunca recebe grant em `bot_settings`/`bot_staff` (fora do escopo do site).
ALTER POLICY message_templates_select ON bot_private.message_templates TO kuruttina_bot, kuruttina_site;
ALTER POLICY message_templates_insert ON bot_private.message_templates TO kuruttina_bot, kuruttina_site;
ALTER POLICY message_templates_update ON bot_private.message_templates TO kuruttina_bot, kuruttina_site;
ALTER POLICY message_templates_delete ON bot_private.message_templates TO kuruttina_bot, kuruttina_site;
RESET ROLE;
