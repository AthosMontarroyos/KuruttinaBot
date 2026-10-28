-- Fila de entrega: o site pede o envio de um template a um canal; o bot (que
-- tem Gateway) consome a fila e publica. Nenhum dos dois processos chama o
-- outro por rede: a fila no banco é o único acoplamento.
SET LOCAL ROLE kuruttina_owner;
CREATE TABLE bot_private.message_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL CHECK (guild_id ~ '^[1-9][0-9]{16,19}$' AND guild_id::numeric <= 18446744073709551615),
  channel_id text NOT NULL CHECK (channel_id ~ '^[1-9][0-9]{16,19}$' AND channel_id::numeric <= 18446744073709551615),
  template_name text NOT NULL CHECK (template_name ~ '^[a-z0-9_-]{1,32}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  requested_by text NOT NULL CHECK (requested_by ~ '^[1-9][0-9]{16,19}$' AND requested_by::numeric <= 18446744073709551615),
  -- Código estável, nunca a mensagem crua do Discord (pode conter detalhe interno).
  error text CHECK (error IS NULL OR error ~ '^[a-z_]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
ALTER TABLE bot_private.message_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_private.message_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY message_deliveries_admin ON bot_private.message_deliveries TO kuruttina_owner USING (true) WITH CHECK (true);

-- Cota simples por servidor: no máximo 20 pedidos pendentes, para o site não encher a fila.
CREATE FUNCTION bot_private.enforce_delivery_quota() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, bot_private AS $$
DECLARE
  pending_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.guild_id || ':deliveries'));
  SELECT count(*) INTO pending_count FROM bot_private.message_deliveries
    WHERE guild_id = NEW.guild_id AND status = 'pending';
  IF pending_count >= 20 THEN
    RAISE EXCEPTION 'message_deliveries_quota_exceeded: guild % already has % pending' , NEW.guild_id, pending_count
      USING ERRCODE = 'KT002';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION bot_private.enforce_delivery_quota() FROM PUBLIC;
CREATE TRIGGER message_deliveries_quota BEFORE INSERT ON bot_private.message_deliveries
  FOR EACH ROW EXECUTE FUNCTION bot_private.enforce_delivery_quota();

-- Site: só pede o envio e vê o histórico do próprio servidor. Nunca marca como enviado.
CREATE POLICY message_deliveries_site_select ON bot_private.message_deliveries FOR SELECT TO kuruttina_site
  USING (guild_id = current_setting('app.guild_id', true));
CREATE POLICY message_deliveries_site_insert ON bot_private.message_deliveries FOR INSERT TO kuruttina_site
  WITH CHECK (guild_id = current_setting('app.guild_id', true));
-- Bot: processo único e confiável (mesma exceção de bot_settings_read na migration original).
-- Sem este SELECT sem filtro, o poller precisaria de uma query por servidor conhecido.
CREATE POLICY message_deliveries_bot_poll ON bot_private.message_deliveries FOR SELECT TO kuruttina_bot USING (true);
CREATE POLICY message_deliveries_bot_update ON bot_private.message_deliveries FOR UPDATE TO kuruttina_bot
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON bot_private.message_deliveries TO kuruttina_site;
GRANT SELECT, UPDATE ON bot_private.message_deliveries TO kuruttina_bot;
GRANT USAGE ON SEQUENCE bot_private.message_deliveries_id_seq TO kuruttina_site;
RESET ROLE;

DO $migration$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON bot_private.message_deliveries FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
