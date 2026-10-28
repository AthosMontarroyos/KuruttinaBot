-- Pastas para organizar templates de mensagem por servidor. Só o site
-- administra (criar/renomear/apagar); o bot nunca lê nem escreve esta tabela,
-- porque ela não afeta o envio nem a renderização, só a organização no painel.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.message_template_folders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  -- Nome de exibição (não é um identificador técnico como o nome do template): sem espaços nas pontas, 1 a 50 caracteres.
  name text NOT NULL CHECK (btrim(name) = name AND length(name) BETWEEN 1 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);
ALTER TABLE bot_private.message_template_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.message_template_folders FORCE ROW LEVEL SECURITY;
CREATE POLICY message_template_folders_admin ON bot_private.message_template_folders TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY message_template_folders_select ON bot_private.message_template_folders FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_template_folders_insert ON bot_private.message_template_folders FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_template_folders_update ON bot_private.message_template_folders FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_template_folders_delete ON bot_private.message_template_folders FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));

-- Cota simples: no máximo 50 pastas por servidor.
CREATE FUNCTION bot_private.enforce_folder_quota() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  folder_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.guild_id || ':folders'));
  SELECT count(*) INTO folder_count FROM bot_private.message_template_folders WHERE guild_id = NEW.guild_id;
  IF folder_count >= 50 THEN
    RAISE EXCEPTION 'message_template_folders_quota_exceeded: guild % already has % folders', NEW.guild_id, folder_count
      USING ERRCODE = 'KT003';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_folder_quota() FROM PUBLIC;
CREATE TRIGGER message_template_folders_quota BEFORE INSERT ON bot_private.message_template_folders
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_folder_quota();

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.message_template_folders TO kuruttina_site;
GRANT USAGE ON SEQUENCE bot_private.message_template_folders_id_seq TO kuruttina_site;

-- Cada template pode pertencer a uma pasta do MESMO servidor. Apagar a pasta só desarquiva os templates (nunca os apaga).
ALTER TABLE bot_private.message_templates
  ADD COLUMN folder_id bigint REFERENCES bot_private.message_template_folders(id) ON DELETE SET NULL;

-- A FK sozinha não garante que a pasta é do mesmo servidor do template (RLS não cruza tabelas).
-- Trigger fecha essa brecha explicitamente, nas duas camadas (banco e aplicação).
CREATE FUNCTION bot_private.enforce_template_folder_guild() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  folder_guild_id text;
BEGIN
  IF NEW.folder_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT guild_id INTO folder_guild_id FROM bot_private.message_template_folders WHERE id = NEW.folder_id;
  IF folder_guild_id IS NULL OR folder_guild_id != NEW.guild_id THEN
    RAISE EXCEPTION 'message_template_folder_guild_mismatch: folder % does not belong to guild %', NEW.folder_id, NEW.guild_id
      USING ERRCODE = 'KT004';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_template_folder_guild() FROM PUBLIC;
CREATE TRIGGER message_templates_folder_guild BEFORE INSERT OR UPDATE OF folder_id ON bot_private.message_templates
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_template_folder_guild();

RESET ROLE;

DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.message_template_folders FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
