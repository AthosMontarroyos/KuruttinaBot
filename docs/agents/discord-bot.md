# Discord bot

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 9. Discord Bot sob regras globais

Desenvolvimento específico do bot pertence à skill existente `.agents/skills/discordbot-developer`; não replique aqui detalhes de commands, components, Gateway ou limites do Discord.

### Regra: skill especializada

**Nível:** MUST

**Regra:** Toda alteração específica de discord.js consulta e segue `discordbot-developer`, além deste arquivo. Use apenas bot accounts e APIs oficiais; self-bot é proibido.

### Regra: separação de bots por ambiente

**Nível:** MUST

**Regra:** Existem duas aplicações/credenciais Discord distintas: Bot Dev para desenvolvimento e Bot Principal para produção/deploy automático Railway. Não coloque dois tokens no mesmo runtime nem crie duas variáveis de token ativas: cada processo lê somente `DISCORD_BOT_TOKEN`; o `.env` local contém apenas o token Dev e o secret store do serviço de produção Railway contém apenas o token Principal. `APP_ENV` é obrigatório e aceita exatamente `development|production`, sem default; não use `NODE_ENV` sozinho para selecionar credencial. Antes do login no Gateway, da readiness e de `AUTO_SYNC_COMMANDS`, valide pela API oficial (`/users/@me`) que o token autentica um bot e que seu ID corresponde ao ID público esperado e versionado para o `APP_ENV`; mismatch, timeout ou resposta inválida falha fechado, com log sem token. Produção também exige `NODE_ENV=production` e o ambiente Railway esperado; comandos Dev devem ser preferencialmente guild-scoped e cada app deve operar somente nas guilds de seu ambiente, com least privilege. Staging futuro não reutiliza nenhuma dessas credenciais sem exceção humana documentada.

### Regra: sincronização automática de commands

**Nível:** MUST

**Regra:** `AUTO_SYNC_COMMANDS` é uma variável booleana estrita do env global, aceitando somente `true` ou `false`, documentada em `.env.example`, com default seguro `false`. Quando `true`, o bootstrap do bot sincroniza automaticamente o conjunto canônico completo de application commands uma única vez por inicialização, antes de declarar readiness. Não registre a sincronização dentro do evento `ready`, pois reconexões repetem o evento e o `PUT` substitui o conjunto do escopo. Quando `false`, pule o redeploy. Falha de sync deve impedir readiness e terminar/falhar o startup com log redigido, sem token. O escopo global/guild deve vir de configuração existente ou futura, sem inventar variável agora.

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
