# Motor de templates de mensagem

## Contexto

O bot vai enviar mensagens configuráveis por servidor, com embeds, botões e menus. Sem um motor central, cada comando montaria `APIEmbed` à mão, interpolaria texto de usuário sem escape e poderia estourar limites do Discord só na hora do envio. Esta etapa (1A) entrega apenas o motor puro: sem persistência, sem comandos, sem discord.js e sem `command-system`. As falas ao usuário ficam para a etapa 1B.

## Decisão

O motor ficava em `apps/bot/src/application/messages/` (`limits.ts`, `template.ts`, `render.ts`). Em 27 de outubro de 2026 foi extraído para o pacote compartilhado `packages/message-templates` (JavaScript puro com JSDoc, mesmo formato de `packages/database`), porque a configuração de templates passou a ser exclusiva do site (veja [a decisão](site-owns-template-config.md)) e o site não pode importar de dentro de `apps/bot`. `apps/bot/src/application/messages/catalog.ts` continua no bot, com as falas do bot, e importa os tipos desse pacote.

1. **Limites do Discord** em `DISCORD_MESSAGE_LIMITS`, congelado: content 2000; 10 embeds; título 256; descrição 4096; 25 campos; nome do campo 256; valor 1024; rodapé 2048; autor 256; 6000 caracteres somados; 5 linhas; 5 botões por linha; rótulo 80; custom_id 100; 25 opções de menu. O limite de 6000 soma título, descrição, campos, rodapé e autor dos embeds (regra do Discord); `content` não entra. Acrescentado: 100 caracteres para rótulo e valor de opção de menu.
2. **Limites por servidor** em `GuildTemplateLimits`, padrão `DEFAULT_GUILD_TEMPLATE_LIMITS` = 100 templates / 50 botões / 50 menus, injetáveis por parâmetro. A contagem é por servidor, somando todos os templates; botões e menus são contados separadamente.
3. **Modelo próprio**, não `APIEmbed`: `MessageTemplate` com `content?`, `embeds` e `components`. Cada linha é `{kind:'buttons'}` ou `{kind:'select'}`, nunca os dois; linha de menu tem um único menu. Imagens do embed (`thumbnail.url`, `image.url`, `author.iconUrl`, `footer.iconUrl`) são só links `https://` literais, sem variáveis; o Discord busca a imagem, o bot não hospeda nada.
4. **Variáveis** no formato `{chave}`, chave em `[a-z]+(\.[a-z]+)*`, declarada como `{ name, maxLength }`. Qualquer outro conteúdo entre chaves (`{a.b()}`) ou chave não declarada (`{constructor}`) é erro de validação. Nada é avaliado: a renderização é uma busca em tabela, sem `eval`, `new Function` ou expressões.
5. **Onde variável é permitida:** somente em texto (content, título, descrição, nome e valor de campo, rodapé, autor, rótulo de botão). Em URL, custom_id, opção e placeholder de menu, qualquer chave é erro.
6. **Escape na renderização**, para todo valor interpolado: escape de Markdown (`* _ ~ \` | > \ [ ] ( ) #`) e neutralização de menções (`@` recebe um espaço de largura zero; `<` seguido de `@`, `#` ou `&` também). O texto escrito pelo autor do template não é escapado.
7. **Tamanho no pior caso:** na validação cada variável ocupa seu `maxLength`; passar do limite do campo é erro ao salvar. Na renderização o valor é escapado e depois truncado em `maxLength` (sem cortar uma sequência de escape), portanto o resultado nunca passa do que a validação previu.
8. **Botões:** link exige `https://` sem variável; botões de resposta usam custom_id `kt:<tipo>:<id>`, até 100 caracteres. Emoji em botão fica fora desta etapa.
9. **Cota:** `checkGuildQuota(currentCount, limits, adding)` recusa quando o servidor já está no limite de templates, ou quando os botões ou menus a adicionar estouram o limite. Não consulta banco.
10. **Erros:** `TemplateValidationError { code; path; message }` com códigos estáveis em inglês (`too_many_embeds`, `unknown_variable`, `limit_exceeded`, `quota_exceeded`...). Mensagens neutras, em português, sem emoji nem personalidade.

## Impacto

- Nova API pura em `application/`; nenhum comportamento existente muda.
- Quem salvar templates (etapa futura) deve chamar `validateTemplate` e `checkGuildQuota` antes de persistir, e `renderTemplate` só com template validado.
- `renderTemplate` mantém chave não declarada como texto literal e valor ausente como texto vazio.

## Controles

- `tests/message-template.test.ts` cobre limites, variáveis, URL, custom_id, escape, truncamento, cota e uma checagem de arquitetura.
- Esse teste falha se algum arquivo de `application/messages/` importar `discord.js`, `command-system`, `infrastructure` ou `commands`.
- Nenhum valor de usuário é interpretado: só passa por escape e truncamento.

## Etapas 1B e 1C (27 de outubro de 2026)

- **1B:** catálogo de falas padrão (`apps/bot/src/application/messages/catalog.ts`) e `context.render(chave, valores)`, que resolve emojis, preenche o template e converte para `CommandReply`. Os comandos `ping`, `ban`, `kick`, `timeout`, `untimeout`, `unban` e as falas do `emojiInfo` passaram a usar esse caminho, com o texto preservado por um snapshot de 199 cenários gravado antes da migração.
- **1C:** persistência por servidor em `bot_private.message_templates` (migration `20261027221916_message_templates.sql`), com RLS por `guild_id`, cota de 100 templates e 50 botões/menus aplicada também por trigger no banco, e o caso de uso `templateAdmin` (`createTemplate`/`updateTemplate`/`listTemplates`/`getTemplate`/`removeTemplate`), que valida nome, tamanho do JSON, o motor e a cota antes de persistir. `checkGuildQuota` ganhou um 4º parâmetro, `isNewTemplate`, para uma edição não ser recusada só por o servidor já estar no limite de templates (só botões e menus continuam contados na edição).
- Templates de usuário não declaravam variáveis nesta etapa (lista sempre vazia); só o catálogo de falas do bot usava `{chave}`. Superado pela seção seguinte.

## Variáveis de ação compartilhadas (30 de outubro de 2026)

Pedido do responsável: uma lista única de variáveis pré-definidas das ações do bot, usada pelo bot e pelo site. `packages/message-templates/variables.js` guarda `ACTION_VARIABLES` (`user.id`, `user.name`, `user.mention`, `user.avatar`, `guild.id`, `guild.name`, `guild.avatar`, `guild.banner`, `guild.membercount`, `nowtimestamp`) e `buildActionValues`, que monta os valores a partir de dados simples. O pedido escrevia `{user.metion}`; a chave ficou `user.mention`.

- **Validação:** `templateAdmin` valida templates de usuário com essa lista, no site e no bot. Isso revoga a regra da etapa 1C de que templates de usuário não declaram variáveis.
- **Formato `raw`:** sem escape, só para valores que o bot gera em formato fixo (ID numérico, menção `<@id>`, URL do CDN do Discord com caracteres seguros, número, `<t:N:f>`). Valor fora do formato é descartado em `buildActionValues`; maior que `maxLength` vira vazio. Nomes de usuário e de servidor continuam escapados (Markdown e menções). A revisão por modelo apontou que aceitar qualquer `https://` em valor `raw` permitiria `@everyone` em URL; por isso só `https://cdn.discordapp.com/`.
- **Imagens (revisa os itens 3 e 5 da decisão):** as variáveis marcadas `image: true` (`user.avatar`, `guild.avatar`, `guild.banner`) valem sozinhas nos campos de imagem do embed (miniatura, imagem, ícone do autor e do rodapé). Link clicável, `custom_id` e menu continuam sem variável. Sem valor, a imagem é omitida e um embed que ficaria vazio é descartado. Motivo: o responsável quer ver a foto, o ícone e o banner como imagem, não como link no texto.
- **Entrega de teste:** a entrega pedida pelo painel não tem usuário disparando; o bot (`client.user`) faz o papel do usuário, igual ao preview. Sem isso `{user.avatar}` ficava vazio e a imagem sumia. Uma ação com usuário real passa o membro.
- **Preview no site:** troca as variáveis por valores de exemplo com `renderText`, as mesmas regras do `renderTemplate`. O bot faz o papel do usuário e o servidor é o aberto no painel; o perfil do bot vem de `/users/@me` pelo token do bot (cabe na [decisão do token](site-holds-bot-token.md)) e sai em `/api/session`, com o banner da guilda. Servidor sem banner fica vazio. Detalhes em [editor de mensagens](../project/message-editor.md).
- **Interface:** a lista aparece na aba Variáveis do editor, e o envio ao canal virou a aba Enviar (o botão e o diálogo "Enviar ao canal" da lista saíram).
- **Pendente:** diff sem aprovação do revisor por modelo (veja o doc de estado); sessões do Docker de desenvolvimento não persistem entre recriações.

## Condição de revisão

Reavaliar quando houver emoji em botões, variável em link clicável, a primeira ação com usuário real (como a entrada de um membro), ou o roteamento de interações de botões e menus (módulo futuro).
