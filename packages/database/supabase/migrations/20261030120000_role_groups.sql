-- Grupos de cargos por servidor. Um grupo é metadado do app (não é um cargo do Discord):
-- nome e lista ordenada de cargos já existentes no servidor. Só o site administra
-- (criar, editar, apagar); o bot apenas lê. Mesmo padrão de isolamento de
-- 20261028115559_message_template_folders.sql: RLS forçada, uma policy por operação,
-- grants explícitos por role.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.role_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  -- Nome de exibição: sem espaços nas pontas, 1 a 50 caracteres.
  name text NOT NULL CHECK (btrim(name) = name AND length(name) BETWEEN 1 AND 50),
  -- Concorrência otimista: UPDATE exige a versão atual e incrementa (como em message_templates).
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by text NOT NULL CHECK (created_by ~ '^[1-9][0-9]{16,19}$' AND created_by::numeric <= 18446744073709551615),
  updated_by text NOT NULL CHECK (updated_by ~ '^[1-9][0-9]{16,19}$' AND updated_by::numeric <= 18446744073709551615),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name),
  -- Alvo da FK composta de role_group_roles, que garante o servidor do grupo nos cargos.
  UNIQUE (id, guild_id)
);

CREATE TABLE bot_private.role_group_roles (
  group_id bigint NOT NULL,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  role_id text NOT NULL CHECK (role_id ~ '^[1-9][0-9]{16,19}$' AND role_id::numeric <= 18446744073709551615),
  -- Ordem de exibição dentro do grupo. Como UNIQUE (group_id, position) com 0..24, o limite de 25 cargos (máximo de opções de um seletor) fica no banco.
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 24),
  PRIMARY KEY (group_id, role_id),
  UNIQUE (group_id, position),
  FOREIGN KEY (group_id, guild_id) REFERENCES bot_private.role_groups (id, guild_id) ON DELETE CASCADE
);

ALTER TABLE bot_private.role_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.role_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY role_groups_admin ON bot_private.role_groups TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY role_groups_select ON bot_private.role_groups FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY role_groups_insert ON bot_private.role_groups FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY role_groups_update ON bot_private.role_groups FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY role_groups_delete ON bot_private.role_groups FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
-- O bot lê os grupos do próprio servidor, mas nunca os altera.
CREATE POLICY role_groups_bot_select ON bot_private.role_groups FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

ALTER TABLE bot_private.role_group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.role_group_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY role_group_roles_admin ON bot_private.role_group_roles TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY role_group_roles_select ON bot_private.role_group_roles FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY role_group_roles_insert ON bot_private.role_group_roles FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY role_group_roles_delete ON bot_private.role_group_roles FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY role_group_roles_bot_select ON bot_private.role_group_roles FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

-- Cota: no máximo 25 grupos por servidor. Mesmo padrão de enforce_folder_quota.
CREATE FUNCTION bot_private.enforce_role_group_quota() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  group_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.guild_id || ':role_groups'));
  SELECT count(*) INTO group_count FROM bot_private.role_groups WHERE guild_id = NEW.guild_id;
  IF group_count >= 25 THEN
    RAISE EXCEPTION 'role_groups_quota_exceeded: guild % already has % groups', NEW.guild_id, group_count
      USING ERRCODE = 'KT006';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_role_group_quota() FROM PUBLIC;
CREATE TRIGGER role_groups_quota BEFORE INSERT ON bot_private.role_groups
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_role_group_quota();

-- updated_at automático; version fica a cargo da aplicação.
CREATE FUNCTION bot_private.touch_role_group() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.touch_role_group() FROM PUBLIC;
CREATE TRIGGER role_groups_touch BEFORE UPDATE ON bot_private.role_groups
  FOR EACH ROW EXECUTE FUNCTION bot_private.touch_role_group();

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.role_groups TO kuruttina_site;
GRANT SELECT ON bot_private.role_groups TO kuruttina_bot;
GRANT USAGE ON SEQUENCE bot_private.role_groups_id_seq TO kuruttina_site;
GRANT SELECT, INSERT, DELETE ON bot_private.role_group_roles TO kuruttina_site;
GRANT SELECT ON bot_private.role_group_roles TO kuruttina_bot;
RESET ROLE;

-- Supabase pode instalar grants padrão para roles de API; revoga explicitamente, como nas migrations anteriores.
DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.role_groups, bot_private.role_group_roles FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
