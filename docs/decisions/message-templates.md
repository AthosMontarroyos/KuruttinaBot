# Motor de templates de mensagem

## Contexto

O bot vai enviar mensagens configuráveis por servidor, com embeds, botões e menus. Sem um motor central, cada comando montaria `APIEmbed` à mão, interpolaria texto de usuário sem escape e poderia estourar limites do Discord só na hora do envio. Esta etapa (1A) entrega apenas o motor puro: sem persistência, sem comandos, sem discord.js e sem `command-system`. As falas ao usuário ficam para a etapa 1B.

## Decisão

O motor fica em `apps/bot/src/application/messages/` (`limits.ts`, `template.ts`, `render.ts`).

1. **Limites do Discord** em `DISCORD_MESSAGE_LIMITS`, congelado: content 2000; 10 embeds; título 256; descrição 4096; 25 campos; nome do campo 256; valor 1024; rodapé 2048; autor 256; 6000 caracteres somados; 5 linhas; 5 botões por linha; rótulo 80; custom_id 100; 25 opções de menu. O limite de 6000 soma título, descrição, campos, rodapé e autor dos embeds (regra do Discord); `content` não entra. Acrescentado: 100 caracteres para rótulo e valor de opção de menu.
2. **Limites por servidor** em `GuildTemplateLimits`, padrão `DEFAULT_GUILD_TEMPLATE_LIMITS` = 100 templates / 50 botões / 50 menus, injetáveis por parâmetro. A contagem é por servidor, somando todos os templates; botões e menus são contados separadamente.
3. **Modelo próprio**, não `APIEmbed`: `MessageTemplate` com `content?`, `embeds` e `components`. Cada linha é `{kind:'buttons'}` ou `{kind:'select'}`, nunca os dois; linha de menu tem um único menu.
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

## Condição de revisão

Reavaliar quando houver emoji em botões, persistência de templates ou necessidade de variáveis em URL.
