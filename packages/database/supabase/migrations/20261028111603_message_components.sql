-- Mapa de custom_id -> ação, para o roteador de interações (etapa 1D).
-- Mantida pelo site ao salvar um template (quem administra templates é só o
-- site); o bot só lê, para decidir o que fazer quando alguém clica.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.message_components (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  -- Apaga junto quando o template dono é apagado ou reescrito.
  template_id bigint NOT NULL REFERENCES bot_private.message_templates(id) ON DELETE CASCADE,
  custom_id text NOT NULL CHECK (custom_id ~ '^kt:[a-z][a-z0-9_]*:[A-Za-z0-9_-]+$' AND length(custom_id) <= 100),
  kind text NOT NULL CHECK (kind IN ('button', 'select_option')),
  -- Ação fechada (reply/edit/delete/dm), validada antes pelo motor; nunca código.
  action jsonb NOT NULL CHECK (octet_length(action::text) <= 2048),
  UNIQUE (guild_id, custom_id)
);
ALTER TABLE bot_private.message_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.message_components FORCE ROW LEVEL SECURITY;
CREATE POLICY message_components_admin ON bot_private.message_components TO kuruttina_owner USING (true) WITH CHECK (true);
-- Site: a mesma role que administra message_templates mantém este mapa, por servidor.
CREATE POLICY message_components_site_select ON bot_private.message_components FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_components_site_insert ON bot_private.message_components FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_components_site_update ON bot_private.message_components FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_components_site_delete ON bot_private.message_components FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
-- Bot: só leitura, para resolver o custom_id clicado. Nunca escreve nesta tabela.
CREATE POLICY message_components_bot_select ON bot_private.message_components FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.message_components TO kuruttina_site;
GRANT SELECT ON bot_private.message_components TO kuruttina_bot;
GRANT USAGE ON SEQUENCE bot_private.message_components_id_seq TO kuruttina_site;
RESET ROLE;

DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.message_components FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
