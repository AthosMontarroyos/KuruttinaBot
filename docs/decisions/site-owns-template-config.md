# Configuração de templates de mensagem é exclusiva do site

## Contexto

O [motor de templates](message-templates.md) foi planejado com duas superfícies de configuração: comandos `/message template` no Discord e, depois, um editor no painel do site. Um primeiro comando Discord (`/message template create|edit|delete|list|show|preview|send`) chegou a ser implementado.

## Decisão

Aprovada pelo responsável em 27 de outubro de 2026: a configuração de templates de mensagem (criar, editar, listar, ver e apagar) é feita **exclusivamente pelo site**, no painel por servidor. Não existe comando de Discord, slash ou `k!`, para essa administração.

O comando `/message template` e toda a fiação criada só para ele foram removidos do bot (`apps/bot/src/commands/mod/message.ts`, o helper de leitura de anexo, as falas `message.template.*` do catálogo e a injeção em `CommandsHandler`/`bootstrap.ts`).

## Impacto

- O motor de validação e a persistência não são exclusivos do bot: o site precisa deles sem importar nada de dentro de `apps/bot` (fronteira entre apps). O motor (`limits`, `template`, `render`, `templateAdmin`) foi extraído para o pacote compartilhado `packages/message-templates`, no mesmo formato JavaScript/JSDoc de `packages/database`. `apps/bot/src/application/messages/catalog.ts` continua no bot (falas do bot) e importa os tipos desse pacote.
- O site ganhou uma role de runtime própria, `kuruttina_site`, separada de `kuruttina_bot` (privilégios mínimos por capacidade: o site nunca lê `bot_settings`/`bot_staff`). As policies de RLS de `bot_private.message_templates` valem para as duas roles, então bot e site veem os mesmos templates por servidor. Registrado em `packages/database/supabase/migrations/20261027230812_site_template_role.sql`.
- A sessão do site passou a guardar o Discord ID de quem logou (só no servidor, nunca enviado ao navegador), para `created_by`/`updated_by` dos templates.
- O painel (`/dashboard`) ganhou a seção "Mensagens" por servidor: criar, editar, listar, ver e apagar, autenticado pela sessão existente e autorizado por `Gerenciar servidor`/dono (a mesma lista de servidores já usada no painel).

## Condição de revisão

Reavaliar se o roteamento de botões e menus (módulo futuro) precisar de uma ação só executável a partir do Discord, ou se um comando de leitura (`show`/`preview`) for pedido de volta por conveniência operacional.
