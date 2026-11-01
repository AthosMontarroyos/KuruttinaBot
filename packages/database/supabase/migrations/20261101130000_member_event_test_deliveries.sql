-- Entrega avulsa: além do template salvo, a fila passa a aceitar um conteúdo direto.
-- content preenchido = mensagem de teste do painel, renderizada com o usuário que pediu (requested_by),
-- sem gravar nada em message_templates. Cada pedido traz exatamente um dos dois: template_name ou content.
SET LOCAL ROLE kuruttina_owner;
ALTER TABLE bot_private.message_deliveries ALTER COLUMN template_name DROP NOT NULL;
ALTER TABLE bot_private.message_deliveries ADD COLUMN content jsonb NULL
  CHECK (content IS NULL OR octet_length(content::text) <= 32768);
ALTER TABLE bot_private.message_deliveries ADD CONSTRAINT message_deliveries_source
  CHECK ((template_name IS NOT NULL) <> (content IS NOT NULL));
RESET ROLE;
