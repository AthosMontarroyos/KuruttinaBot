-- Configuração das ações personalizadas (20261030130000_custom_actions.sql): funções de cada
-- botão e opções de cada menu de seleção, cada opção com suas funções. Mesmo padrão de isolamento:
-- RLS forçada, uma policy por operação, grants explícitos por role. Só o site grava; o bot só lê.
SET LOCAL ROLE kuruttina_owner;

-- Alvos das FKs compostas: garantem que cada função/opção fica no mesmo servidor do pai.
ALTER TABLE bot_private.custom_buttons ADD CONSTRAINT custom_buttons_id_guild_id_key UNIQUE (id, guild_id);
ALTER TABLE bot_private.custom_selects ADD CONSTRAINT custom_selects_id_guild_id_key UNIQUE (id, guild_id);

-- Flag do menu: quando ligada, a seleção do usuário é mantida depois da ação.
ALTER TABLE bot_private.custom_selects ADD COLUMN keep_selection boolean NOT NULL DEFAULT false;

CREATE TABLE bot_private.custom_button_functions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  button_id bigint NOT NULL,
  -- Ordem de execução dentro do botão. Com UNIQUE (button_id, position) e 0..9, o limite de 10 funções fica no banco.
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  -- Tipo da função: só o formato; o catálogo de tipos é validado pela aplicação.
  type text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- Configuração livre da função (objeto JSON). A aplicação limita a 2 KB compactos; o banco aceita até 4 KB porque jsonb::text acrescenta espaços.
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 4096),
  UNIQUE (button_id, position),
  FOREIGN KEY (button_id, guild_id) REFERENCES bot_private.custom_buttons (id, guild_id) ON DELETE CASCADE
);

CREATE TABLE bot_private.custom_select_options (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  select_id bigint NOT NULL,
  -- Ordem no menu. Com UNIQUE (select_id, position) e 0..24, o limite de 25 opções (máximo do seletor) fica no banco.
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 24),
  -- Rótulo da opção: sem espaços nas pontas, 1 a 100 caracteres.
  label text NOT NULL CHECK (btrim(label) = label AND length(label) BETWEEN 1 AND 100),
  UNIQUE (select_id, position),
  -- Alvo da FK composta de custom_select_option_functions.
  UNIQUE (id, guild_id),
  FOREIGN KEY (select_id, guild_id) REFERENCES bot_private.custom_selects (id, guild_id) ON DELETE CASCADE
);

CREATE TABLE bot_private.custom_select_option_functions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  option_id bigint NOT NULL,
  -- Ordem de execução dentro da opção: 0..9 com UNIQUE (option_id, position), no máximo 10 funções.
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  -- Tipo da função: só o formato; o catálogo de tipos é validado pela aplicação.
  type text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- Configuração livre da função (objeto JSON). A aplicação limita a 2 KB compactos; o banco aceita até 4 KB porque jsonb::text acrescenta espaços.
  config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 4096),
  UNIQUE (option_id, position),
  FOREIGN KEY (option_id, guild_id) REFERENCES bot_private.custom_select_options (id, guild_id) ON DELETE CASCADE
);

ALTER TABLE bot_private.custom_button_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.custom_button_functions FORCE ROW LEVEL SECURITY;
CREATE POLICY custom_button_functions_admin ON bot_private.custom_button_functions TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY custom_button_functions_select ON bot_private.custom_button_functions FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_button_functions_insert ON bot_private.custom_button_functions FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_button_functions_update ON bot_private.custom_button_functions FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_button_functions_delete ON bot_private.custom_button_functions FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
-- O bot lê a configuração do próprio servidor, mas nunca a altera.
CREATE POLICY custom_button_functions_bot_select ON bot_private.custom_button_functions FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

ALTER TABLE bot_private.custom_select_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.custom_select_options FORCE ROW LEVEL SECURITY;
CREATE POLICY custom_select_options_admin ON bot_private.custom_select_options TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY custom_select_options_select ON bot_private.custom_select_options FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_options_insert ON bot_private.custom_select_options FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_options_update ON bot_private.custom_select_options FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_options_delete ON bot_private.custom_select_options FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_options_bot_select ON bot_private.custom_select_options FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

ALTER TABLE bot_private.custom_select_option_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.custom_select_option_functions FORCE ROW LEVEL SECURITY;
CREATE POLICY custom_select_option_functions_admin ON bot_private.custom_select_option_functions TO kuruttina_owner USING (true) WITH CHECK (true);
CREATE POLICY custom_select_option_functions_select ON bot_private.custom_select_option_functions FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_option_functions_insert ON bot_private.custom_select_option_functions FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_option_functions_update ON bot_private.custom_select_option_functions FOR UPDATE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true)) WITH CHECK (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_option_functions_delete ON bot_private.custom_select_option_functions FOR DELETE TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY custom_select_option_functions_bot_select ON bot_private.custom_select_option_functions FOR SELECT TO kuruttina_bot
  USING (guild_id = current_setting('app.guild_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON bot_private.custom_button_functions, bot_private.custom_select_options, bot_private.custom_select_option_functions TO kuruttina_site;
GRANT SELECT ON bot_private.custom_button_functions, bot_private.custom_select_options, bot_private.custom_select_option_functions TO kuruttina_bot;
GRANT USAGE ON SEQUENCE bot_private.custom_button_functions_id_seq, bot_private.custom_select_options_id_seq, bot_private.custom_select_option_functions_id_seq TO kuruttina_site;
RESET ROLE;

-- Supabase pode instalar grants padrão para roles de API; revoga explicitamente, como nas migrations anteriores.
DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.custom_button_functions, bot_private.custom_select_options, bot_private.custom_select_option_functions FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
