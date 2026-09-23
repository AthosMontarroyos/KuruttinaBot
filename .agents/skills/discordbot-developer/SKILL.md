---
name: discordbot-developer
description: Desenvolver ou revisar o runtime Discord do KuruttinaBot com discord.js, incluindo commands, Gateway, interactions e permissões. Não usar para UI, banco ou operação isolados.
metadata:
  short-description: Desenvolvimento com discord.js
---

# Bot Discord

Leia AGENTS.md, docs/agents/discord-bot.md e somente a referência abaixo que a tarefa exigir. Confirme a versão instalada de discord.js antes de usar exemplos externos. Preserve a composição em apps/bot, a separação entre definição/execução/publicação de commands e o contrato de autorização compartilhado por slash e prefixo.

Invariantes: somente bot accounts e APIs oficiais; nunca exponha tokens. Intents e partials não substituem permissões por operação. Responda ou defira interactions aceitas dentro do prazo da plataforma; collectors têm timeout. O PUT de commands substitui o escopo inteiro e nunca roda a cada reconexão. Cache miss não prova inexistência. Limite filas, caches, retries e menções. O estado compartilhado com o futuro site pertence ao banco, não à memória do processo.

Valide em proporção à mudança com typecheck, testes de commands/adapters, build limpo e, quando autorizado, aplicação Discord de development. O documento de domínio contém políticas locais e [o estado implementado](../../../docs/project/current-state.md) mostra os consumidores reais.

Referências sob demanda:
- [discordjs-core.md](references/discordjs-core.md): Client, imports, estrutura, cache e testes.
- [interactions-components.md](references/interactions-components.md): slash, components, modals e resposta.
- [gateway-rest-scale.md](references/gateway-rest-scale.md): Gateway, REST, sharding e rate limits.
- [security-permissions-policy.md](references/security-permissions-policy.md): OAuth, instalação e permissões.
- [limits.md](references/limits.md): limites; confira valores dinâmicos nas fontes oficiais.
- [versions-and-sources.md](references/versions-and-sources.md): compatibilidade e fontes.
