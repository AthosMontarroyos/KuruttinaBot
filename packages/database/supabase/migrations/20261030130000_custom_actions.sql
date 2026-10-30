-- Ações personalizadas por servidor, em duas listas independentes: botões
-- (custom_buttons) e menus de seleção (custom_selects). Cada linha é uma ação com
-- nome, definida no painel e usada depois por botões/menus de mensagens e templates.
-- Só o site administra (criar, editar, apagar); o bot apenas lê. Mesmo padrão de
-- 20261030120000_role_groups.sql: RLS forçada, uma policy por operação, grants
-- explícitos por role e cota por servidor.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.custom_buttons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  -- Nome de exibição: sem espaços nas pontas, 1 a 50 caracteres.
  name text NOT NULL CHECK (btrim(name) = name AND length(name) BETWEEN 1 AND 50),
  -- Ação fechada (reply/edit/delete/dm), validada antes pelo motor; nunca código. Começa vazia: o nome é criado antes da ação.
  action jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(action) = 'object' AND octet_length(action::text) <= 2048),
  -- Concorrência otimista: UPDATE exige a versão atual e incrementa (como em message_templates).
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by text NOT NULL CHECK (created_by ~ '^[1-9][0-9]{16,19}$' AND created_by::numeric <= 18446744073709551615),
  updated_by text NOT NULL CHECK (updated_by ~ '^[1-9][0-9]{16,19}$' AND updated_by::numeric <= 18446744073709551615),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);

CREATE TABLE bot_private.custom_selects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  name text NOT NULL CHECK (btrim(name) = name AND length(name) BETWEEN 1 AND 50),
  action jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(action) = 'object' AND octet_length(action::text) <= 2048),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by text NOT NULL CHECK (created_by ~ '^[1-9][0-9]{16,19}$' AND created_by::numeric <= 18446744073709551615),
  updated_by text NOT NULL CHECK (updated_by ~ '^[1-9][0-9]{16,19}$' AND updated_by::numeric <= 18446744073709551615),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);

ALTER TABLE bot_private.custom_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.custom_buttons FORCE ROW LEVEL SECURITY;
CREATE POLICY custom_buttons_admin ON bot_private.custom_buttons TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY custom_buttons_select ON bot_private.custom_buttons FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_buttons_insert ON bot_private.custom_buttons FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_buttons_update ON bot_private.custom_buttons FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_buttons_delete ON bot_private.custom_buttons FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
-- O bot lê as ações do próprio servidor, mas nunca as altera.
CREATE POLICY custom_buttons_bot_select ON bot_private.custom_buttons FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

ALTER TABLE bot_private.custom_selects ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.custom_selects FORCE ROW LEVEL SECURITY;
CREATE POLICY custom_selects_admin ON bot_private.custom_selects TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY custom_selects_select ON bot_private.custom_selects FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_selects_insert ON bot_private.custom_selects FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_selects_update ON bot_private.custom_selects FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_selects_delete ON bot_private.custom_selects FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_selects_bot_select ON bot_private.custom_selects FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

-- Cota: no máximo 50 botões e 50 menus por servidor (o "6 / 50" do painel). Mesmo padrão de enforce_role_group_quota.
CREATE FUNCTION bot_private.enforce_custom_button_quota() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  button_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.guild_id || ':custom_buttons'));
  SELECT count(*) INTO button_count FROM bot_private.custom_buttons WHERE guild_id = NEW.guild_id;
  IF button_count >= 50 THEN
    RAISE EXCEPTION 'custom_buttons_quota_exceeded: guild % already has % buttons', NEW.guild_id, button_count
      USING ERRCODE = 'KT007';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_custom_button_quota() FROM PUBLIC;
CREATE TRIGGER custom_buttons_quota BEFORE INSERT ON bot_private.custom_buttons
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_custom_button_quota();

CREATE FUNCTION bot_private.enforce_custom_select_quota() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  select_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.guild_id || ':custom_selects'));
  SELECT count(*) INTO select_count FROM bot_private.custom_selects WHERE guild_id = NEW.guild_id;
  IF select_count >= 50 THEN
    RAISE EXCEPTION 'custom_selects_quota_exceeded: guild % already has % select menus', NEW.guild_id, select_count
      USING ERRCODE = 'KT008';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_custom_select_quota() FROM PUBLIC;
CREATE TRIGGER custom_selects_quota BEFORE INSERT ON bot_private.custom_selects
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_custom_select_quota();

-- updated_at automático; version fica a cargo da aplicação.
CREATE FUNCTION bot_private.touch_custom_action() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.touch_custom_action() FROM PUBLIC;
CREATE TRIGGER custom_buttons_touch BEFORE UPDATE ON bot_private.custom_buttons
  FOR EACH ROW EXECUTE FUNCTION bot_private.touch_custom_action();
CREATE TRIGGER custom_selects_touch BEFORE UPDATE ON bot_private.custom_selects
  FOR EACH ROW EXECUTE FUNCTION bot_private.touch_custom_action();

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.custom_buttons, bot_private.custom_selects TO kuruttina_site;
GRANT SELECT ON bot_private.custom_buttons, bot_private.custom_selects TO kuruttina_bot;
GRANT USAGE ON SEQUENCE bot_private.custom_buttons_id_seq, bot_private.custom_selects_id_seq TO kuruttina_site;
RESET ROLE;

-- Supabase pode instalar grants padrão para roles de API; revoga explicitamente, como nas migrations anteriores.
DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.custom_buttons, bot_private.custom_selects FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
