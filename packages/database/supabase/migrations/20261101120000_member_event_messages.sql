-- Mensagens de entrada e saída de membros, uma por evento (join ou leave) e por servidor.
-- O site configura (canal, conteúdo, ignorar bots) e grava; o bot apenas lê.
-- Mesmo padrão de isolamento de 20261030120000_role_groups.sql: RLS forçada, uma policy
-- por operação, grants explícitos por role e sem DELETE para o site.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.member_event_messages (
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  -- Evento de membro: entrada ou saída. Com a PK (guild_id, event), há no máximo uma configuração por evento e servidor.
  event text NOT NULL CHECK (event IN ('join', 'leave')),
  enabled boolean NOT NULL DEFAULT false,
  -- Canal de destino. Ligado exige canal: a mensagem nunca fica habilitada sem destino.
  channel_id text NULL CHECK (channel_id IS NULL OR (channel_id ~ '^[1-9][0-9]{16,19}$' AND channel_id::numeric <= 18446744073709551615)),
  ignore_bots boolean NOT NULL DEFAULT false,
  -- Conteúdo da mensagem (mesmo formato de message_templates), limitado a 32 KiB em texto JSON.
  content jsonb NOT NULL CHECK (octet_length(content::text) <= 32768),
  -- Concorrência otimista: UPDATE exige a versão atual e incrementa (como em role_groups).
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by text NOT NULL CHECK (created_by ~ '^[1-9][0-9]{16,19}$' AND created_by::numeric <= 18446744073709551615),
  updated_by text NOT NULL CHECK (updated_by ~ '^[1-9][0-9]{16,19}$' AND updated_by::numeric <= 18446744073709551615),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, event),
  CONSTRAINT member_event_messages_enabled_channel CHECK (NOT enabled OR channel_id IS NOT NULL)
);

ALTER TABLE bot_private.member_event_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.member_event_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY member_event_messages_admin ON bot_private.member_event_messages TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY member_event_messages_select ON bot_private.member_event_messages FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY member_event_messages_insert ON bot_private.member_event_messages FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY member_event_messages_update ON bot_private.member_event_messages FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
-- Sem policy de DELETE: a configuração é editada, não apagada.
-- O bot lê a configuração do próprio servidor, mas nunca a altera.
CREATE POLICY member_event_messages_bot_select ON bot_private.member_event_messages FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

-- updated_at automático; version fica a cargo da aplicação.
CREATE FUNCTION bot_private.touch_member_event_message() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.touch_member_event_message() FROM PUBLIC;
CREATE TRIGGER member_event_messages_touch BEFORE UPDATE ON bot_private.member_event_messages
  FOR EACH ROW EXECUTE FUNCTION bot_private.touch_member_event_message();

GRANT SELECT, INSERT, UPDATE ON bot_private.member_event_messages TO kuruttina_site;
GRANT SELECT ON bot_private.member_event_messages TO kuruttina_bot;
RESET ROLE;

-- Supabase pode instalar grants padrão para roles de API; revoga explicitamente, como nas migrations anteriores.
DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.member_event_messages FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
