---
name: discordbot-developer
description: Desenvolver, revisar, depurar e evoluir bots Discord em JavaScript ou TypeScript com discord.js, incluindo Gateway, application commands, interactions, components, permissões, rate limits, sharding e limites oficiais da plataforma. Não usar para Pycord, discord.py, self-bots, Next.js, Docker/R2 ou schema SQL isolado.
metadata:
  short-description: Desenvolvimento especializado com discord.js
---

# Discordbot Developer

Implemente bots de produção exclusivamente com `discord.js` e APIs oficiais do Discord. Preserve a arquitetura e as convenções do projeto existente; não migre JavaScript para TypeScript, CommonJS para ESM, ou versões de dependências sem pedido ou necessidade demonstrada.

Esta skill adapta `discord-bot-architect` (Apache-2.0, `vibeship-spawner-skills`) ao ecossistema `discord.js` e a complementa com documentação oficial conferida em 2026-09-07.

## Quando usar
discord.js, Gateway, application commands, interactions, components, permissões da plataforma, rate limits, sharding e limites oficiais.
## Não usar quando
A mudança não toca o runtime Discord (site Next.js, SQL/migrations isolados, Docker/Square, CLI R2) ou pede Pycord, discord.py ou self-bot.
## Responsabilidades
Adapters Discord, commands/events, deployments REST, intents/partials e respeito aos limites da plataforma; regras de produto do bot ficam em `docs/agents/discord-bot.md`.
## Fluxo operacional
Ler AGENTS.md e o documento do bot; inspecionar versão instalada; carregar só as referências desta skill que a tarefa exigir; validar em proporção ao risco.

## Fluxo de trabalho

1. Inspecione `package.json`, lockfile, versão do Node, estilo de módulos, estrutura de comandos/eventos e testes antes de propor código.
2. Quando a tarefa depender da API ou compatibilidade, identifique a versão instalada de `discord.js` e consulte a documentação dessa versão. Não misture `main`, v14 e exemplos de v15.
3. Carregue somente as referências pertinentes, inclusive em implementações ponta a ponta; leia todas apenas quando todos os domínios estiverem realmente envolvidos.
4. Separe regras de negócio dos adapters Discord. Mantenha definição, execução e deployment de comandos como responsabilidades distintas.
5. Valide em proporção ao risco: typecheck, lint e testes locais; use uma aplicação/guild de desenvolvimento para integrações reais quando autorizado.
6. Em upgrades ou suspeita de mudança de plataforma, confira os changelogs do `discord.js` e do Discord no intervalo relevante.

## Invariantes

- Nunca exponha, registre, versione ou solicite token de bot, client secret, webhook token ou credencial de usuário.
- Nunca implemente self-bot nem automação de conta de usuário.
- Intents não são permissões. Solicite apenas intents necessários e valide permissões no momento da operação.
- Cache miss não prova inexistência; partial garante somente `id` até `fetch()` bem-sucedido.
- Reconheça interactions em até 3 segundos. Autocomplete não pode ser deferred.
- Responda ou defira cada interaction de componente aceita. Todo collector temporário precisa de timeout/idle ou outra condição de encerramento.
- Registro REST por `PUT` substitui o conjunto de comandos do escopo. Não registre comandos em todo `ready`.
- Controle menções com `allowedMentions` no Client ou payload, especialmente ao interpolar conteúdo externo ou de usuário.
- Permissão nominal não supera a hierarquia de cargos.
- Estado em memória não é compartilhado entre shards ou processos.
- Components V2 são irreversíveis por mensagem e incompatíveis com campos legados específicos.
- Deixe `@discordjs/rest` administrar buckets e 429; não crie sleeps fixos ou retries concorrentes.

## Checklist de segurança
- [ ] Sem token/secret em código, logs ou artefatos; self-bot recusado.
- [ ] Intents mínimos; permissões conferidas na operação; `allowedMentions` controlado.
## Checklist de recursos
- [ ] Sem cache/collector/retry ilimitado; REST deixado aos buckets do discord.js.
## Checklist de validação
- [ ] Typecheck, lint e testes dos adapters/commands alterados; estados de interaction cobertos.

## Referências

- Contratos do bot neste repositório: [Discord bot](../../../docs/agents/discord-bot.md).
- Para arquitetura, Client, intents, partials, cache, módulos, TypeScript e testes: [discordjs-core.md](references/discordjs-core.md).
- Para commands, interactions, autocomplete, components, modals, collectors e mensagens: [interactions-components.md](references/interactions-components.md).
- Para Gateway, sharding, REST, rate limits, webhooks e voice: [gateway-rest-scale.md](references/gateway-rest-scale.md).
- Para OAuth2, instalação, permissões, segredos, dados, monetização e políticas: [security-permissions-policy.md](references/security-permissions-policy.md).
- Para valores exatos de campos e quotas: [limits.md](references/limits.md). Confirme limites dinâmicos na documentação oficial antes de codificá-los.
- Para upgrades e fontes canônicas: [versions-and-sources.md](references/versions-and-sources.md).

## Arquivos relevantes
`apps/bot/src/**`, deployments, handlers, testes de commands/interactions e `docs/agents/discord-bot.md`.
## Integração com outras skills
security-reviewer, testing-auditor, database-developer, docker-squarecloud-developer e project-architect.

## Resultado esperado

Entregue código compatível com a versão instalada, tratamento explícito dos estados de interaction, privilégios mínimos, erros observáveis sem dados sensíveis e testes das regras relevantes. Diferencie claramente limitação da plataforma, comportamento do `discord.js` e inferência da implementação.
