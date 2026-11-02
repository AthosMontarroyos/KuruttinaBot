# Discord bot

> Referência da skill. Leia as seções aplicáveis à operação, incluindo seus requisitos e exceções; não carregue os demais assuntos preventivamente.

## 9. Discord Bot sob regras globais

Esta referência mantém os contratos locais de commands, credenciais e ciclo de vida. O procedimento de alteração está no [SKILL.md](../SKILL.md).

### Regra: skill especializada

**Nível:** MUST

**Regra:** Toda alteração específica de discord.js consulta e segue `discordbot-developer`, além deste arquivo. Use apenas bot accounts e APIs oficiais; self-bot é proibido.

### Regra: seleção de credenciais e alvo

**Nível:** MUST

**Regra:** `APP_ENV` aceita somente `development` ou `production` e determina o comportamento do ambiente, sem fallback. A credencial ativa é só `DISCORD_BOT_TOKEN` e `DISCORD_BOT_ID`, sem sufixo. O config Doppler `dev` e o config `prd` guardam esses mesmos nomes, cada um com a aplicação daquele ambiente. O processo não lê um segundo par. O Gateway e cada deploy usam apenas a credencial ativa. Application Emojis de production não são criados pelo bot: `/dev emoji add` só orienta o workflow manual, que lê `DISCORD_BOT_TOKEN` do config `prd` com `DOPPLER_TOKEN` no ambiente GitHub `production`. O command não recebe credenciais. Nomes com sufixo de ambiente não são lidos. O histórico da exceção de credenciais duplas está no [ADR](../../../../docs/decisions/dual-bot-credentials.md). Antes do Gateway ou de qualquer deploy, valide `/users/@me` com timeout, confirme `bot: true` e o ID público esperado; mismatch, timeout ou resposta inválida falha fechado, sem token nos logs. Um bot `production` rejeita banco de development pela conferência de `bot_settings.environment`.

### Regra: sincronização de commands no startup

**Nível:** MUST

**Regra:** A sincronização dos application commands é obrigatória e roda em todo startup do bot; não há variável, flag nem Compose que a desligue (`AUTO_SYNC_COMMANDS` não existe mais). O bootstrap a executa uma única vez por inicialização, antes de declarar readiness, e só publica a diferença: para cada escopo (o global e cada guilda de desenvolvimento cadastrada em `bot_private.bot_dev_guilds`) lê os commands registrados no Discord e compara com o conjunto local por nome, normalizando os campos que o Discord preenche (`id`, `version`, valores falsos ou nulos). Nada adicionado, editado ou removido: nada é escrito (`commands_sync_unchanged`). Qualquer diferença: um único `PUT` do conjunto do escopo, que publica o novo ou editado e já limpa o removido do registro do Discord (`commands_sync_applied`, com os nomes de cada grupo no log). Escopo que ficou sem commands é esvaziado; escopo vazio que já estava vazio não é tocado. Não registre a sincronização dentro do evento `ready`, pois reconexões repetem o evento. Falha de sync impede readiness e termina/falha o startup com log redigido, sem token. Exceção única: na sincronização de uma guilda de desenvolvimento, `50001` (Missing Access) e `10004` (Unknown Guild) geram o aviso `staff_guild_sync_skipped` nomeando o `guildId`; essa guilda é ignorada e o processo segue com as guildas restantes, no startup e em `npm run deploy:commands`. Outros erros, e qualquer erro do escopo global, continuam falhando como antes. `npm run deploy:commands` continua publicando sempre (`force`). O escopo global e as guildas de desenvolvimento vêm do cadastro existente, sem inventar variável. Sem guildas cadastradas, o startup não publica conjunto de guilda e não falha; o processo não apaga commands de guildas que saíram do cadastro.

### Regra: contrato e carregamento de commands

**Nível:** MUST

**Regra:** Todo módulo de command declara nome, descrição não vazia e uma única forma de execução sobre o contrato compartilhado `CommandContext`: um executor raiz, ou uma tabela `routes` de subcomandos com o caminho slash abaixo da raiz e aliases exatos por prefixo — o loader exige exatamente uma das duas formas e rejeita rotas, aliases ou duplicidades inválidos. Todo módulo declara também, obrigatoriamente, uma política `access`: `public` explícito para comandos abertos ou `guild`/`staff` com as permissões efetivas exigidas do membro e do app, o envio quando aplicável e, opcionalmente, a copy de negação própria. Todo módulo declara ainda um `scope` de publicação (`global` ou `dev-guild`): o `payload` publica cada escopo somente no seu deployment, `dev-guild` nunca entra no conjunto global, e o `CommandsHandler` rejeita módulo cujo `scope` e política `staff` divirjam. O loader rejeita política ausente ou inválida e `default_member_permissions` divergente das permissões de membro declaradas. Uma rota pode declarar `access` opcional no formato dos requisitos de guilda, sem `kind`. O loader rejeita esse bloco quando o formato é inválido ou quando ele inclui `kind`. O dispatcher aplica esses requisitos depois da política raiz, nos dois transports; eles somam permissões e não a substituem nem a enfraquecem. `requireChannelSend: false` na rota não cancela o envio exigido na raiz. A recusa fora de um canal de texto usa `messages.guildOnly` da rota quando ela existe. A política `staff` exige também papel mínimo Creator/Dev e uma guilda de desenvolvimento cadastrada, com identidade confiável e consulta transacional sem cache. O `CommandsHandler` valida a política antes do executor, em ambos os transports, reconhecendo e negando fechado — sem chamar o executor — quando as permissões de contexto não estão disponíveis. Slash é a definição canônica; todos os commands registrados também são acessíveis automaticamente por `k!` e pelo alias `K!`, sem opt-out, configuração ou comando de ativação. Em módulo com rotas, o endereço por prefixo é o alias da rota (por exemplo `k!emoji-add` ou `k!emoji-info`) e a raiz nua responde com a mensagem de uso, listando os aliases, sem executar. O loader é chamado explicitamente pelo composition root, descobre somente módulos executáveis nas categorias `dev/`, `mod/` e `public/` de `apps/bot/src/commands`, falha fechado — inclusive antes de importar um arquivo fora dessa organização — e emite um log estruturado `command_loaded`; o catálogo rejeita nome duplicado. Os adapters de slash e mensagem usam o mesmo executor, sem duplicar lógica nos commands. `acknowledge()` reconhece trabalho lento e `reply()` conclui a resposta em ambos os transports. Capacidades novas, como argumentos, devem ampliar o contrato e ambos os adapters conjuntamente. O uso de `MessageContent` para esse despacho foi autorizado explicitamente pelo usuário; ele também deve estar habilitado no Developer Portal para cada aplicação.

### Regra: documentação obrigatória do command

**Nível:** MUST

**Regra:** Todo módulo de command declara, além do contrato acima, a documentação que alimenta `/help` e a página `/comandos` do site: descrição não vazia (a do `SlashCommandBuilder`, e a de cada subcomando), `help.topic` (`public`, `utility`, `fun`, `mod` ou `dev`) e exemplos de uso reais. Sem `routes`, `help.examples` lista de 1 a 3 pares `{ slash, prefix }`. Com `routes`, `help` leva só o `topic` e cada rota declara os próprios `examples`. O `slash` começa com o endereço slash (`/nome` ou `/nome caminho`) e o `prefix` com `k!` mais o nome ou um alias da rota; o loader rejeita exemplo de outro comando, texto vazio ou maior que 200 caracteres. O tópico acompanha a pasta: `mod/` exige `mod`, `dev/` exige `dev` e `public/` aceita `public`, `utility` ou `fun`. A forma prefixada não é opcional nem configurável: todo command a tem (`k!nome`, ou `k!alias` na rota), e os exemplos precisam mostrá-la. Não há lista de commands para manter à mão: `CommandsHandler` monta o catálogo vivo (`buildCatalog`, sem commands `staff`) e o injeta em `context.commandCatalog`, que `/help` lê; o site lê `packages/command-catalog/catalog.js`, regenerado por `scripts/commands-catalog.mjs` a cada `npm run site build` e `npm run typecheck`. Um command novo aparece nos dois sem outra edição.

### Regra: categorias de commands

**Nível:** MUST

**Regra:** Commands registráveis ficam somente nas categorias `apps/bot/src/commands/public/`, `commands/mod/` e `commands/dev/`. A categoria é o primeiro segmento relativo à raiz do catálogo; subpastas mais profundas não criam outra categoria. `public/` exige política `public` e escopo `global`. `mod/` exige política `guild` e escopo `global` (`ban`, `clear`, `emoji`, `kick`, `timeout`, `unban` e `untimeout`; o caminho canônico de `ban` é `apps/bot/src/commands/mod/ban.ts`, o de `clear` é `apps/bot/src/commands/mod/clear.ts`, o de `kick` é `apps/bot/src/commands/mod/kick.ts`, o de `timeout` é `apps/bot/src/commands/mod/timeout.ts`, o de `unban` é `apps/bot/src/commands/mod/unban.ts` e o de `untimeout` é `apps/bot/src/commands/mod/untimeout.ts`). `dev/` exige política `staff` e escopo `dev-guild` (em qualquer profundidade; hoje `dev/emoji.ts`) e tem deploy exclusivo nas guildas de desenvolvimento cadastradas, nunca no payload global. As três correspondências são obrigatórias: `public/` ⇔ `public` ⇔ `global`, `mod/` ⇔ `guild` ⇔ `global`, `dev/` ⇔ `staff` ⇔ `dev-guild`. Não reaproveite `mod/` nem `public/` para comandos de equipe.

O loader resolve a raiz padrão como `../commands/` a partir de `command-system/loadCommands`, no TypeScript e no JavaScript compilado. Um diretório alternativo é outra raiz de catálogo e segue as mesmas regras. Antes de importar qualquer módulo, arquivo executável na raiz ou sob categoria diferente de `dev/`, `mod/` e `public/` causa `CommandLoadError`, com o caminho e a organização esperada. A descoberta é recursiva dentro das três categorias, carrega só a extensão do runtime (`.ts` ou `.js`) e ignora `.d.ts`, Markdown, source maps e outros arquivos não executáveis. Não há exclusão por nome: `types.ts`, `access.ts`, `emojiAdd.ts` e qualquer outro módulo executável dentro de uma categoria entram na descoberta e precisam exportar um comando válido. Helper, executor ou teste colocado ali impede o carregamento. Falha de localização, contrato, rota, permissão ou duplicidade impede readiness e a publicação de um catálogo parcial. Não há watcher nem recarregamento automático.

Contrato, executor compartilhado, adapter e teste ficam fora de `commands/`. Onde colocar cada arquivo está em [Organização dos arquivos do bot](../../../../docs/project/bot-file-organization.md). A decisão está no [ADR do catálogo](../../../../docs/decisions/command-catalog-layout.md). Ao mover um módulo, atualize seus imports e a documentação, remova a cópia no caminho anterior e valide a descoberta automática e o build limpo para evitar registros duplicados por artefatos antigos.

### Regra: memória do bot

**Nível:** MUST

**Regra:** Justifique intents, partials e caches; limite sweepers/cache managers, collectors, listeners, timers, filas e dados temporários. Collector temporário sempre possui timeout/idle/condição de encerramento. Cache miss não deve ser tratado automaticamente como inexistência.

### Regra: estado distribuído

**Nível:** MUST

**Regra:** Não use memória do processo como estado autoritativo que bot, site, shards ou réplicas precisem compartilhar. Persista estado durável no banco e modele idempotência/lock para concorrência.

### Regra: ciclo de vida

**Nível:** MUST

**Regra:** No startup, valide config e conexão antes de declarar readiness. No shutdown, pare de aceitar trabalho, encerre timers/collectors, destrua client Discord e feche pool com timeout.

### Regra: variáveis de ação e entrega de templates

**MUST:** A entrega de um template renderiza com `ACTION_VARIABLES` e `renderTemplate` antes de `toCommandReply`; os valores vêm de `actionValuesFor(guild, user?)` (`infrastructure/discord/messages/actionValues.ts`), que só converte objetos do discord.js. Sem usuário disparando (entrega pedida pelo painel), o bot (`client.user`) faz o papel do usuário. Uma ação nova com usuário real (entrada de membro, por exemplo) passa esse membro. Variável nova entra em `packages/message-templates/variables.js`, nunca no bot; valor `raw` só em formato fixo gerado pelo bot (ID, menção, URL do CDN, número). Veja [editor de mensagens](../../../../docs/project/message-editor.md).

### Regra: voz das respostas

**Nível:** MUST

**Regra:** Toda resposta ao usuário segue as regras obrigatórias [Personalidade das falas](../../../../docs/project/bot-personality.md#personalidade-das-falas) e [Emojis nas falas](../../../../docs/project/bot-personality.md#emojis-nas-falas), inclusive o escopo que elas deixam de fora. O tom não reduz a clareza, não estoura o limite de mensagem do Discord e não altera o contrato de autorização nem a copy que explica a negação.
