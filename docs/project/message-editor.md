# Editor de mensagens e variáveis

Estado implementado em 30 de outubro de 2026. A decisão e os motivos estão em [templates de mensagem](../decisions/message-templates.md); o procedimento de trabalho está na skill `website-developer`.

## Variáveis de ação

A lista única está em `packages/message-templates/variables.js` (`ACTION_VARIABLES`) e é o que o bot preenche e o site valida e mostra. Nada copia essa lista: o site importa de `@kuruttina/message-templates/variables` e `/render` (subpaths do pacote; `apps/site/tsconfig.json` tem `allowJs` por isso). Variável nova entra só ali, com teste em `tests/message-variables.test.ts`.

- **Texto:** vale em mensagem, título e descrição do embed, nome e valor de campo, rodapé, nome do autor e rótulo de botão.
- **Imagem:** `{user.avatar}`, `{guild.avatar}` e `{guild.banner}` (marcadas `image: true`) valem sozinhas em miniatura, imagem, ícone do autor e ícone do rodapé. Em link clicável (URL do título, do autor, de botão), `custom_id` e menu, variável continua proibida.
- **Sem valor:** o texto fica vazio; o campo de imagem é descartado; um embed que sobra vazio é removido do envio (o Discord o recusa).

## Editor (`apps/site/src/components/message-editor/`)

- **Abas:** Visual, JSON, Variáveis e Enviar. **Variáveis** (`TemplateGuide.tsx`) é só a lista; clicar copia `{chave}`. **Enviar** só aparece quando quem usa o editor passa `sendPanel`; no painel de modelos ela escolhe um canal (`ChannelSelect`) e pede a entrega da versão **salva**. Em modelo novo, avisa que é preciso salvar antes; com alterações pendentes, avisa que o envio usa a versão salva.
- **Preview** (`preview-values.tsx`): troca as variáveis por valores de exemplo, para o texto e para os campos de imagem. O bot faz o papel do usuário (nome, ID, foto, `@nome` no lugar da menção) e o servidor é o aberto no painel (nome, ID, ícone, banner, membros); `{nowtimestamp}` vira data curta em pt-BR. Servidor sem banner mostra o ícone vazio, sem erro. Se o texto inteiro ficar vazio, o campo mostra a chave para continuar clicável. O cabeçalho da mensagem usa o nome do bot.
- **Dados do preview:** vêm de `GET /api/session`. A resposta autenticada traz `guilds[].bannerUrl` (pode faltar em sessão gravada antes do campo) e `bot { id, name, avatarUrl }`, lidos pelo token do bot em `/users/@me` e guardados 10 minutos em `server/auth.ts` (falha guarda 30 segundos; sem token, o campo `bot` não vem e o preview usa "Kuruttina"). O ID do usuário continua fora da resposta.
- **Lista de modelos** (`dashboard/[serverId]/embeds/templates/view.tsx`): some enquanto se cria ou edita um modelo. Cada item tem Editar e uma lixeira vermelha no hover; o botão "Enviar ao canal" e o diálogo antigo de envio saíram (o envio é pela aba Enviar). A tela de detalhe mantém Ver JSON, Editar e Apagar em texto. A lixeira de pasta também fica vermelha no hover.
- **Sessão expirada:** se a lista falha com `unauthenticated`, mostra "Sua sessão expirou" e leva ao `/login`; qualquer outra falha mantém "Não foi possível falar com o servidor agora".

## Entrega no bot

`deliveryPoller.ts` renderiza o template com `ACTION_VARIABLES` antes do `toCommandReply`. `actionValuesFor(guild, user?)` (`actionValues.ts`) converte objetos do discord.js em valores. A entrega pedida pelo painel não tem usuário disparando, então o bot (`client.user`) faz esse papel, igual ao preview. Uma ação com usuário real (entrada de membro, por exemplo) passa o membro como segundo argumento.

## Entrada e saída de membros (1º de novembro de 2026)

Seção **Entrada e saída** do painel (`dashboard/[serverId]/member-events/view.tsx`): duas abas (Entrada e Saída), cada uma com interruptor, canal (`ChannelSelect`), "Ignorar bots" e o mesmo `MessageEditor` dos modelos, com `allowComponents={false}` (sem Action Rows: o mapa de Components é amarrado a um modelo salvo, então botões e menus ficam fora desta mensagem).

- **Persistência:** `bot_private.member_event_messages`, uma linha por servidor e evento (`join` ou `leave`), com o JSON da mensagem, o canal e a versão (concorrência otimista). O site grava (`/api/guilds/:guildId/member-events[/:event]`, `server/member-events.ts`); o bot só lê.
- **Variáveis:** as mesmas de `ACTION_VARIABLES`, sem nenhuma nova. `{user.*}` é quem entrou ou saiu, `{guild.membercount}` é a contagem já depois da entrada ou saída (o discord.js atualiza `memberCount` antes de emitir o evento), `{nowtimestamp}` é o momento e `{guild.*}` é o servidor.
- **Bot:** `events/members/memberEvents.ts` trata `GuildMemberAdd` e `GuildMemberRemove`, renderiza com `actionValuesFor(guild, member.user)` e envia com `allowedMentions: { parse: [] }`. Falha (canal apagado, sem permissão) só gera log `member_event_failed`.
- **Intent:** exige o **Server Members Intent** (privilegiado) ligado no Developer Portal de cada bot, além de `GatewayIntentBits.GuildMembers` no `bootstrap.ts`. Sem ele o Discord não envia os eventos.

## Limites conhecidos

- A revisão por modelo do diff desta funcionalidade não foi aprovada (o revisor recusou arquivo novo fora do formato de diff). As correções apontadas foram feitas e os testes passam, mas o diff final não foi revisado de novo.
- No Docker de desenvolvimento as sessões do painel não sobrevivem à recriação dos contêineres (veja [referência de deployment](../../.claude/skills/project-operations/references/deployment.md)).
- O preview não reproduz tudo do Discord: menção aparece como `@nome` sem destaque e o timestamp como data fixa do momento.

## Seletor de emojis

`EmojiPanel` (painel reutilizável: abas de categoria, busca, tons de pele e emojis do servidor) e `EmojiPicker` (gatilho com popover que usa o painel) estão em `apps/site/src/components/selectors/`. Os emojis padrão vêm de `emojibase-data/pt/compact.json`, carregado por `EmojiPanel.tsx` só na primeira abertura do painel (import dinâmico, chunk separado); a montagem das categorias, a busca e os tons (`emoji-data.ts`) são funções puras, testadas em `tests/emoji-data.test.ts`. Escolher um emoji padrão grava `{ name }`; um emoji do servidor grava `{ id, name, animated? }`.
