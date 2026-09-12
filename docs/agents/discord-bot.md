# Discord bot

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 9. Discord Bot sob regras globais

Desenvolvimento específico do bot pertence à skill existente `.agents/skills/discordbot-developer`; não replique aqui detalhes de commands, components, Gateway ou limites do Discord.

### Regra: skill especializada

**Nível:** MUST

**Regra:** Toda alteração específica de discord.js consulta e segue `discordbot-developer`, além deste arquivo. Use apenas bot accounts e APIs oficiais; self-bot é proibido.

### Regra: seleção de credenciais e alvo

**Nível:** MUST

**Regra:** `BOT_TARGET` aceita somente `development` ou `production` e seleciona exatamente uma credencial ativa, sem fallback. A configuração exige sempre os dois pares `DISCORD_BOT_TOKEN_DEVELOPMENT`/`DISCORD_BOT_ID_DEVELOPMENT` e `DISCORD_BOT_TOKEN_PRODUCTION`/`DISCORD_BOT_ID_PRODUCTION`, inclusive quando apenas um alvo será conectado. O runtime pode manter ambas disponíveis de forma somente leitura para operações cross-bot autorizadas, mas o Gateway e cada deploy usam apenas a credencial ativa. Variáveis legadas ou seleção implícita por ambiente não são permitidas. Esta é a exceção vigente às regras históricas de uma credencial por runtime; contexto, impacto e controles estão em [ADR de credenciais duplas](../decisions/dual-bot-credentials.md). Antes do Gateway ou de qualquer deploy, valide `/users/@me` com timeout, confirme `bot: true` e o ID público esperado; mismatch, timeout ou resposta inválida falha fechado, sem token nos logs.

### Regra: sincronização automática de commands

**Nível:** MUST

**Regra:** `AUTO_SYNC_COMMANDS` é uma variável booleana estrita do env global, aceitando somente `true` ou `false`, documentada em `.env.example`, com default seguro `false`. Quando `true`, o bootstrap do bot sincroniza automaticamente o conjunto canônico completo de application commands uma única vez por inicialização, antes de declarar readiness. Não registre a sincronização dentro do evento `ready`, pois reconexões repetem o evento e o `PUT` substitui o conjunto do escopo. Quando `false`, pule o redeploy. Falha de sync deve impedir readiness e terminar/falhar o startup com log redigido, sem token. O escopo global/guild deve vir de configuração existente ou futura, sem inventar variável agora.

### Regra: contrato e carregamento de commands

**Nível:** MUST

**Regra:** Todo módulo de command declara nome, descrição não vazia e a opção booleana `prefixCommand`. O registry descobre automaticamente os módulos sob `apps/bot/src/commands`, falha fechado diante de módulo inválido ou nome duplicado e emite um log estruturado `command_loaded` por command carregado. `prefixCommand` expressa compatibilidade do command, mas não autoriza habilitar `MessageContent` nem implementar despacho por prefixo sem decisão explícita.

### Regra: registry de parceiros

**Nível:** MUST

**Regra:** O parser do registry falha fechado: aceita objeto e campos exatos, strings sem coerção, enum case-sensitive, IDs únicos e no máximo um `Creator`; desconhecido, duplicado ou segundo `Creator` rejeita todo o arquivo, e zero `Creator` não aciona fallback. Permissões por ação usam mapa explícito deny-by-default, nunca ordem lexical ou índice do enum. O arquivo não é gravável por UI/bot; exemplos nunca são carregados.

### Regra: memória do bot

**Nível:** MUST

**Regra:** Justifique intents, partials e caches; limite sweepers/cache managers, collectors, listeners, timers, filas e dados temporários. Collector temporário sempre possui timeout/idle/condição de encerramento. Cache miss não deve ser tratado automaticamente como inexistência.

### Regra: estado distribuído

**Nível:** MUST

**Regra:** Não use memória do processo como estado autoritativo que bot, site, shards ou réplicas precisem compartilhar. Persista estado durável no banco e modele idempotência/lock para concorrência.

### Regra: ciclo de vida

**Nível:** MUST

**Regra:** No startup, valide config e conexão antes de declarar readiness. No shutdown, pare de aceitar trabalho, encerre timers/collectors, destrua client Discord e feche pool com timeout.
