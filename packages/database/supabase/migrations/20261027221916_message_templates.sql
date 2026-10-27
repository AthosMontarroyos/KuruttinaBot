-- Templates de mensagem por servidor (etapa 1C). Mesmo padrão de isolamento
-- e privilégios mínimos de 20260923102843_bot_access.sql: schema bot_private,
-- RLS forçada, grants explícitos só para kuruttina_bot.
-- Como na migration anterior, os objetos ficam sob o papel kuruttina_owner,
-- não sob quem está aplicando a migration.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.message_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  name text NOT NULL CHECK (name ~ '^[a-z0-9_-]{1,32}$'),
  -- MessageTemplate já validado pelo motor (apps/bot/src/application/messages).
  content jsonb NOT NULL CHECK (octet_length(content::text) <= 32768),
  -- Contagem de componentes do template, para a cota ser somada sem reler `content`.
  button_count smallint NOT NULL DEFAULT 0 CHECK (button_count BETWEEN 0 AND 50),
  menu_count smallint NOT NULL DEFAULT 0 CHECK (menu_count BETWEEN 0 AND 50),
  -- Concorrência otimista: UPDATE exige a versão atual e incrementa.
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by text NOT NULL CHECK (created_by ~ '^[1-9][0-9]{16,19}$' AND created_by::numeric <= 18446744073709551615),
  updated_by text NOT NULL CHECK (updated_by ~ '^[1-9][0-9]{16,19}$' AND updated_by::numeric <= 18446744073709551615),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);
ALTER TABLE bot_private.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.message_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY message_templates_admin ON bot_private.message_templates TO kuruttina_owner USING (true) WITH CHECK (true);
-- Uma policy por operação: cada comando (SELECT/INSERT/UPDATE/DELETE) só vê e só grava linhas do próprio servidor.
CREATE POLICY message_templates_select ON bot_private.message_templates FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_templates_insert ON bot_private.message_templates FOR INSERT TO kuruttina_bot
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_templates_update ON bot_private.message_templates FOR UPDATE TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_templates_delete ON bot_private.message_templates FOR DELETE TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

-- Cota por servidor (100 templates, 50 botões, 50 menus), aplicada no banco como
-- segunda barreira: a aplicação já recusa antes (checkGuildQuota), mas um
-- escritor concorrente só é bloqueado de forma confiável aqui.
-- NÃO é SECURITY DEFINER: corre com o privilégio de quem chama (kuruttina_bot),
-- então as próprias policies de SELECT acima já escopam a contagem por guild_id.
CREATE FUNCTION bot_private.enforce_message_template_quota() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  template_count integer;
  button_total integer;
  menu_total integer;
BEGIN
  -- Serializa escritores do mesmo servidor, para a contagem abaixo não ter corrida.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.guild_id));
  SELECT count(*) INTO template_count
    FROM bot_private.message_templates
    WHERE guild_id = NEW.guild_id AND id IS DISTINCT FROM OLD.id;
  IF TG_OP = 'INSERT' AND template_count >= 100 THEN
    RAISE EXCEPTION 'message_templates_quota_exceeded: guild % already has % templates', NEW.guild_id, template_count
      USING ERRCODE = 'KT001';
  END IF;
  SELECT coalesce(sum(button_count), 0), coalesce(sum(menu_count), 0) INTO button_total, menu_total
    FROM bot_private.message_templates
    WHERE guild_id = NEW.guild_id AND id IS DISTINCT FROM OLD.id;
  IF button_total + NEW.button_count > 50 THEN
    RAISE EXCEPTION 'message_templates_quota_exceeded: guild % would have % buttons', NEW.guild_id, button_total + NEW.button_count
      USING ERRCODE = 'KT001';
  END IF;
  IF menu_total + NEW.menu_count > 50 THEN
    RAISE EXCEPTION 'message_templates_quota_exceeded: guild % would have % menus', NEW.guild_id, menu_total + NEW.menu_count
      USING ERRCODE = 'KT001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_message_template_quota() FROM PUBLIC;
CREATE TRIGGER message_templates_quota BEFORE INSERT OR UPDATE ON bot_private.message_templates
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_message_template_quota();

-- updated_at automático; version fica a cargo da aplicação (concorrência otimista explícita).
CREATE FUNCTION bot_private.touch_message_template() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.touch_message_template() FROM PUBLIC;
CREATE TRIGGER message_templates_touch BEFORE UPDATE ON bot_private.message_templates
  FOR EACH ROW EXECUTE FUNCTION bot_private.touch_message_template();

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.message_templates TO kuruttina_bot;
GRANT USAGE ON SEQUENCE bot_private.message_templates_id_seq TO kuruttina_bot;
RESET ROLE;

-- Supabase pode instalar grants padrão para roles de API; revoga explicitamente, como na migration anterior.
DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.message_templates FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
