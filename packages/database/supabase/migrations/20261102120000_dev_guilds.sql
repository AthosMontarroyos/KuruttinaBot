-- Várias guildas de desenvolvimento. A coluna singleton dev_guild_id não cabe
-- mais de um snowflake, e um text[] não aceita CHECK por elemento sem subquery
-- (proibido no CHECK) ou função auxiliar. Cada linha repete o CHECK já usado
-- em bot_staff. Zero linhas é válido: production pode não ter guilda.
-- A coluna antiga é copiada e removida na mesma migration; o processo anterior
-- não lê o cadastro depois que ela deixa de existir.
SET LOCAL ROLE kuruttina_owner;

CREATE TABLE bot_private.bot_dev_guilds (
  guild_id text PRIMARY KEY CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615)
);

INSERT INTO bot_private.bot_dev_guilds (guild_id)
SELECT dev_guild_id FROM bot_private.bot_settings;

ALTER TABLE bot_private.bot_dev_guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.bot_dev_guilds FORCE ROW LEVEL SECURITY;
CREATE POLICY dev_guilds_admin ON bot_private.bot_dev_guilds TO kuruttina_owner USING (true) WITH CHECK (true);
-- O runtime lê a lista inteira para publicar os commands de equipe e para autorizar a guilda atual.
CREATE POLICY dev_guilds_read ON bot_private.bot_dev_guilds FOR SELECT TO kuruttina_bot USING (true);

DROP POLICY staff_self_read ON bot_private.bot_staff;
CREATE POLICY staff_self_read ON bot_private.bot_staff FOR SELECT TO kuruttina_bot USING (
  active AND user_id = current_setting('app.discord_user_id', true)
  AND EXISTS (
    SELECT 1 FROM bot_private.bot_dev_guilds AS dev_guilds
    WHERE dev_guilds.guild_id = current_setting('app.guild_id', true)
  )
);

GRANT SELECT ON bot_private.bot_dev_guilds TO kuruttina_bot;
REVOKE ALL ON TABLE bot_private.bot_dev_guilds FROM PUBLIC;
REVOKE ALL ON TABLE bot_private.bot_dev_guilds FROM kuruttina_site;

ALTER TABLE bot_private.bot_settings DROP COLUMN dev_guild_id;

RESET ROLE;

DO $migration$
DECLARE api_role text;
BEGIN
  EXECUTE 'REVOKE ALL ON TABLE bot_private.bot_dev_guilds FROM PUBLIC';
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE bot_private.bot_dev_guilds FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
