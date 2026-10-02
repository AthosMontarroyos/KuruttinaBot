# Discord bot

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 9. Discord Bot sob regras globais

Desenvolvimento específico do bot pertence à skill existente `.agents/skills/discordbot-developer`; não replique aqui detalhes de commands, components, Gateway ou limites do Discord.

### Regra: skill especializada

**Nível:** MUST

**Regra:** Toda alteração específica de discord.js consulta e segue `discordbot-developer`, além deste arquivo. Use apenas bot accounts e APIs oficiais; self-bot é proibido.

### Regra: seleção de credenciais e alvo

**Nível:** MUST

**Regra:** `APP_ENV` aceita somente `development` ou `production` e seleciona exatamente uma credencial ativa, sem fallback. A configuração exige sempre os dois pares `DISCORD_BOT_TOKEN_DEVELOPMENT`/`DISCORD_BOT_ID_DEVELOPMENT` e `DISCORD_BOT_TOKEN_PRODUCTION`/`DISCORD_BOT_ID_PRODUCTION`, inclusive quando apenas um alvo será conectado. O runtime pode manter ambas disponíveis de forma somente leitura para operações cross-bot autorizadas, mas o Gateway e cada deploy usam apenas a credencial ativa. A operação cross-bot autorizada é `/dev emoji add`: ela cria Application Emojis somente na aplicação de production, por REST, depois de confirmar `/users/@me` contra `DISCORD_BOT_ID_PRODUCTION`. O command não recebe o objeto de credenciais. Variáveis legadas ou seleção implícita por ambiente não são permitidas. Esta é a exceção vigente às regras históricas de uma credencial por runtime; contexto, impacto e controles estão em [ADR de credenciais duplas](../decisions/dual-bot-credentials.md). Antes do Gateway ou de qualquer deploy, valide `/users/@me` com timeout, confirme `bot: true` e o ID público esperado; mismatch, timeout ou resposta inválida falha fechado, sem token nos logs.

### Regra: sincronização automática de commands

**Nível:** MUST

**Regra:** `AUTO_SYNC_COMMANDS` é uma variável booleana estrita do env global, aceitando somente `true` ou `false`, documentada em `.env.example`, com default seguro `false` apenas quando ausente; string vazia é inválida. Quando `true`, o bootstrap do bot sincroniza automaticamente o conjunto canônico completo de application commands uma única vez por inicialização, antes de declarar readiness. Não registre a sincronização dentro do evento `ready`, pois reconexões repetem o evento e o `PUT` substitui o conjunto do escopo. Quando `false`, pule o redeploy. Falha de sync deve impedir readiness e terminar/falhar o startup com log redigido, sem token. O escopo global/guild deve vir de configuração existente ou futura, sem inventar variável agora.

### Regra: contrato e carregamento de commands

**Nível:** MUST

**Regra:** Todo módulo de command declara nome, descrição não vazia e uma única forma de execução sobre o contrato compartilhado `CommandContext`: um executor raiz, ou uma tabela `routes` de subcomandos com o caminho slash abaixo da raiz e aliases exatos por prefixo — o loader exige exatamente uma das duas formas e rejeita rotas, aliases ou duplicidades inválidos. Todo módulo declara também, obrigatoriamente, uma política `access`: `public` explícito para comandos abertos ou `guild`/`staff` com as permissões efetivas exigidas do membro e do app, o envio quando aplicável e, opcionalmente, a copy de negação própria. Todo módulo declara ainda um `scope` de publicação (`global` ou `dev-guild`): o `payload` publica cada escopo somente no seu deployment, `dev-guild` nunca entra no conjunto global, e o `CommandsHandler` rejeita módulo cujo `scope` e política `staff` divirjam. O loader rejeita política ausente ou inválida e `default_member_permissions` divergente das permissões de membro declaradas. Uma rota pode declarar `access` opcional no formato dos requisitos de guilda, sem `kind`. O loader rejeita esse bloco quando o formato é inválido ou quando ele inclui `kind`. O dispatcher aplica esses requisitos depois da política raiz, nos dois transports; eles somam permissões e não a substituem nem a enfraquecem. `requireChannelSend: false` na rota não cancela o envio exigido na raiz. A recusa fora de um canal de texto usa `messages.guildOnly` da rota quando ela existe. A política `staff` exige também papel mínimo Creator/Dev e a guilda cadastrada, com identidade confiável e consulta transacional sem cache. O `CommandsHandler` valida a política antes do executor, em ambos os transports, reconhecendo e negando fechado — sem chamar o executor — quando as permissões de contexto não estão disponíveis. Slash é a definição canônica; todos os commands registrados também são acessíveis automaticamente por `k!` e pelo alias `K!`, sem opt-out, configuração ou comando de ativação. Em módulo com rotas, o endereço por prefixo é o alias da rota (por exemplo `k!emoji-add` ou `k!emoji-info`) e a raiz nua responde com a mensagem de uso, listando os aliases, sem executar. O loader é chamado explicitamente pelo composition root, descobre somente módulos executáveis nas categorias `dev/`, `mod/` e `public/` de `apps/bot/src/commands`, falha fechado — inclusive antes de importar um arquivo fora dessa organização — e emite um log estruturado `command_loaded`; o catálogo rejeita nome duplicado. Os adapters de slash e mensagem usam o mesmo executor, sem duplicar lógica nos commands. `acknowledge()` reconhece trabalho lento e `reply()` conclui a resposta em ambos os transports. Capacidades novas, como argumentos, devem ampliar o contrato e ambos os adapters conjuntamente. O uso de `MessageContent` para esse despacho foi autorizado explicitamente pelo usuário; ele também deve estar habilitado no Developer Portal para cada aplicação.

### Regra: categorias de commands

**Nível:** MUST

**Regra:** Commands registráveis ficam somente nas categorias `apps/bot/src/commands/public/`, `commands/mod/` e `commands/dev/`. A categoria é o primeiro segmento relativo à raiz do catálogo; subpastas mais profundas não criam outra categoria. `public/` exige política `public` e escopo `global`. `mod/` exige política `guild` e escopo `global` (`clear`, `emoji`, `kick`, `timeout` e `untimeout`; o caminho canônico de `clear` é `apps/bot/src/commands/mod/clear.ts`, o de `kick` é `apps/bot/src/commands/mod/kick.ts`, o de `timeout` é `apps/bot/src/commands/mod/timeout.ts` e o de `untimeout` é `apps/bot/src/commands/mod/untimeout.ts`). `dev/` exige política `staff` e escopo `dev-guild` (em qualquer profundidade; hoje `dev/emoji.ts`) e tem deploy exclusivo na guilda de desenvolvimento cadastrada, nunca no payload global. As três correspondências são obrigatórias: `public/` ⇔ `public` ⇔ `global`, `mod/` ⇔ `guild` ⇔ `global`, `dev/` ⇔ `staff` ⇔ `dev-guild`. Não reaproveite `mod/` nem `public/` para comandos de equipe.

O loader resolve a raiz padrão como `../commands/` a partir de `command-system/loadCommands`, no TypeScript e no JavaScript compilado. Um diretório alternativo é outra raiz de catálogo e segue as mesmas regras. Antes de importar qualquer módulo, arquivo executável na raiz ou sob categoria diferente de `dev/`, `mod/` e `public/` causa `CommandLoadError`, com o caminho e a organização esperada. A descoberta é recursiva dentro das três categorias, carrega só a extensão do runtime (`.ts` ou `.js`) e ignora `.d.ts`, Markdown, source maps e outros arquivos não executáveis. Não há exclusão por nome: `types.ts`, `access.ts`, `emojiAdd.ts` e qualquer outro módulo executável dentro de uma categoria entram na descoberta e precisam exportar um comando válido. Helper, executor ou teste colocado ali impede o carregamento. Falha de localização, contrato, rota, permissão ou duplicidade impede readiness e a publicação de um catálogo parcial. Não há watcher nem recarregamento automático.

Contrato, executor compartilhado, adapter e teste ficam fora de `commands/`. Onde colocar cada arquivo está em [Organização dos arquivos do bot](../project/bot-file-organization.md). A decisão está no [ADR do catálogo](../decisions/command-catalog-layout.md). Ao mover um módulo, atualize seus imports e a documentação, remova a cópia no caminho anterior e valide a descoberta automática e o build limpo para evitar registros duplicados por artefatos antigos.

### Regra: memória do bot

**Nível:** MUST

**Regra:** Justifique intents, partials e caches; limite sweepers/cache managers, collectors, listeners, timers, filas e dados temporários. Collector temporário sempre possui timeout/idle/condição de encerramento. Cache miss não deve ser tratado automaticamente como inexistência.

### Regra: estado distribuído

**Nível:** MUST

**Regra:** Não use memória do processo como estado autoritativo que bot, site, shards ou réplicas precisem compartilhar. Persista estado durável no banco e modele idempotência/lock para concorrência.

### Regra: ciclo de vida

**Nível:** MUST

**Regra:** No startup, valide config e conexão antes de declarar readiness. No shutdown, pare de aceitar trabalho, encerre timers/collectors, destrua client Discord e feche pool com timeout.

### Regra: voz das respostas

**Nível:** MUST

**Regra:** Toda resposta ao usuário segue as regras obrigatórias [Personalidade das falas](../project/bot-personality.md#personalidade-das-falas) e [Emojis nas falas](../project/bot-personality.md#emojis-nas-falas), inclusive o escopo que elas deixam de fora. O tom não reduz a clareza, não estoura o limite de mensagem do Discord e não altera o contrato de autorização nem a copy que explica a negação.
