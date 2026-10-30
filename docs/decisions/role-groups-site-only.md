# Grupos de cargos são administrados só pelo site

## Contexto

O servidor precisa agrupar cargos já existentes para oferecê-los juntos. Um grupo não é um cargo do Discord: não cria, não renomeia e não concede nenhum cargo por si só. Ele é um metadado do app, guardado no banco, com nome e a lista ordenada de cargos do próprio servidor.

## Decisão

Aprovada pelo responsável em 30 de outubro de 2026: grupos de cargos são **criados, editados e apagados exclusivamente pelo painel do site**, pelo administrador do servidor. Não existe comando de Discord, slash ou `k!`, para essa administração, no mesmo padrão de [configuração de templates exclusiva do site](site-owns-template-config.md).

O bot apenas lê os grupos. A role `kuruttina_bot` tem `SELECT` nas tabelas `bot_private.role_groups` e `bot_private.role_group_roles`, com RLS por servidor, e nenhum grant de escrita.

Quem administra o servidor é quem passa na autorização do painel (dono, Administrador ou Gerenciar servidor), a mesma regra usada pelos templates.

## Impacto

- Tabelas: `bot_private.role_groups` e `bot_private.role_group_roles`, na migration `packages/database/supabase/migrations/20261030120000_role_groups.sql`. A FK composta garante que o cargo fica no mesmo servidor do grupo.
- Limites: 25 grupos por servidor (trigger, código `KT006`) e 25 cargos por grupo (`position` entre 0 e 24, com `UNIQUE (group_id, position)`). O limite de 25 segue o máximo de opções de um seletor do Discord.
- Os cargos enviados são conferidos na lista do Discord do servidor: precisam existir e não podem ser gerenciados (bots e integrações).
- A migration foi aplicada no projeto Supabase de development em 30 de outubro de 2026. Production ainda não recebeu essa migration.
- A API está em `apps/site/server/role-groups.ts` e a aba **Cargos** do painel em `apps/site/src/app/dashboard/[serverId]/role-groups/`.

## Condição de revisão

Reavaliar se um comando de Discord for pedido para consultar ou montar grupos, ou se o bot passar a usar os grupos em mensagens com botões e menus. Essa leitura pelo bot já é permitida pelo banco, mas nenhum fluxo do bot a usa ainda.
