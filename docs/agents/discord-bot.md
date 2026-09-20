# Discord bot

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 9. Discord Bot sob regras globais

Desenvolvimento específico do bot pertence à skill existente `.agents/skills/discordbot-developer`; não replique aqui detalhes de commands, components, Gateway ou limites do Discord.

### Regra: skill especializada

**Nível:** MUST

**Regra:** Toda alteração específica de discord.js consulta e segue `discordbot-developer`, além deste arquivo. Use apenas bot accounts e APIs oficiais; self-bot é proibido.

### Regra: seleção de credenciais e alvo

**Nível:** MUST

**Regra:** `APP_ENV` aceita somente `development` ou `production` e seleciona exatamente uma credencial ativa, sem fallback. A configuração exige sempre os dois pares `DISCORD_BOT_TOKEN_DEVELOPMENT`/`DISCORD_BOT_ID_DEVELOPMENT` e `DISCORD_BOT_TOKEN_PRODUCTION`/`DISCORD_BOT_ID_PRODUCTION`, inclusive quando apenas um alvo será conectado. O runtime pode manter ambas disponíveis de forma somente leitura para operações cross-bot autorizadas, mas o Gateway e cada deploy usam apenas a credencial ativa. Variáveis legadas ou seleção implícita por ambiente não são permitidas. Esta é a exceção vigente às regras históricas de uma credencial por runtime; contexto, impacto e controles estão em [ADR de credenciais duplas](../decisions/dual-bot-credentials.md). Antes do Gateway ou de qualquer deploy, valide `/users/@me` com timeout, confirme `bot: true` e o ID público esperado; mismatch, timeout ou resposta inválida falha fechado, sem token nos logs.

### Regra: sincronização automática de commands

**Nível:** MUST

**Regra:** `AUTO_SYNC_COMMANDS` é uma variável booleana estrita do env global, aceitando somente `true` ou `false`, documentada em `.env.example`, com default seguro `false` apenas quando ausente; string vazia é inválida. Quando `true`, o bootstrap do bot sincroniza automaticamente o conjunto canônico completo de application commands uma única vez por inicialização, antes de declarar readiness. Não registre a sincronização dentro do evento `ready`, pois reconexões repetem o evento e o `PUT` substitui o conjunto do escopo. Quando `false`, pule o redeploy. Falha de sync deve impedir readiness e terminar/falhar o startup com log redigido, sem token. O escopo global/guild deve vir de configuração existente ou futura, sem inventar variável agora.

### Regra: contrato e carregamento de commands

**Nível:** MUST

**Regra:** Todo módulo de command declara nome, descrição não vazia e um único executor baseado no contrato compartilhado `CommandContext`. Slash é a definição canônica; todos os commands registrados também são acessíveis automaticamente por `k!` e pelo alias `K!`, sem opt-out, configuração ou comando de ativação. O loader é chamado explicitamente pelo composition root, descobre os módulos sob `apps/bot/src/commands`, falha fechado diante de módulo inválido e emite um log estruturado `command_loaded`; o catálogo rejeita nome duplicado. Os adapters de slash e mensagem usam o mesmo executor, sem duplicar lógica nos commands. `acknowledge()` reconhece trabalho lento e `reply()` conclui a resposta em ambos os transports. Capacidades novas, como argumentos, devem ampliar o contrato e ambos os adapters conjuntamente. O uso de `MessageContent` para esse despacho foi autorizado explicitamente pelo usuário; ele também deve estar habilitado no Developer Portal para cada aplicação.

### Regra: memória do bot

**Nível:** MUST

**Regra:** Justifique intents, partials e caches; limite sweepers/cache managers, collectors, listeners, timers, filas e dados temporários. Collector temporário sempre possui timeout/idle/condição de encerramento. Cache miss não deve ser tratado automaticamente como inexistência.

### Regra: estado distribuído

**Nível:** MUST

**Regra:** Não use memória do processo como estado autoritativo que bot, site, shards ou réplicas precisem compartilhar. Persista estado durável no banco e modele idempotência/lock para concorrência.

### Regra: ciclo de vida

**Nível:** MUST

**Regra:** No startup, valide config e conexão antes de declarar readiness. No shutdown, pare de aceitar trabalho, encerre timers/collectors, destrua client Discord e feche pool com timeout.
