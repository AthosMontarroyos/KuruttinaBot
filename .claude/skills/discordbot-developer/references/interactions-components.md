# Commands, interactions e components

## Registro de application commands

Separe definição, execução e deployment. Registre em script REST explícito: guild com `Routes.applicationGuildCommands(clientId, guildId)` e global com `Routes.applicationCommands(clientId)`.

`REST.put(..., { body: commands })` substitui o conjunto do escopo; uma lista incompleta remove comandos. Mudanças em `execute()` não exigem redeploy; nome, descrição, opções, contextos e permissões padrão exigem. Prefira `setContexts()`, `setIntegrationTypes()` e `setDefaultMemberPermissions()`.

## Ciclo de resposta

Discrimine com `isChatInputCommand()`, `isContextMenuCommand()`, `isAutocomplete()`, `isButton()`, `isAnySelectMenu()` e `isModalSubmit()`.

- Responda em 3 s; para trabalho lento, `deferReply()` e `editReply()`.
- Após resposta inicial, use `followUp()`.
- Componentes podem usar `update()` ou `deferUpdate()`.
- Use `flags: MessageFlags.Ephemeral`; propriedades antigas no payload estão depreciadas em v14 recente.
- Token de interaction dura 15 min. Ephemeral escolhido no defer não muda depois.
- Modal precisa ser a primeira resposta daquele caminho; não defira antes de `showModal()`.

## Autocomplete e collectors

Autocomplete usa `getFocused()` e `interaction.respond()` em 3 s, não pode ser deferred e aceita 25 choices. Para fonte lenta, use cache/busca limitada.

Components duráveis usam router central por `customId`; fluxos temporários podem usar collectors. Todo collector precisa de término, filtros de identidade/escopo, resposta para cada interaction aceita e tratamento de timeout. Fechar modal não emite submit. `custom_id` não carrega segredo; valide estado no servidor.

## Components V2

Confirme suporte na versão instalada. V2 exige `MessageFlags.IsComponentsV2`, é irreversível por mensagem e incompatível com `content`, `embeds`, `poll`, `stickers` e `shared_client_theme`. `id` de layout não é `custom_id`.

Tipos recentes incluem Text Display, Section, Media Gallery, File, Separator, Container, Label, File Upload, Radio Group e Checkbox Group. Em modals novos, prefira `Label`; Action Row + Text Input está depreciado.

## Mensagens

Defina `defaultAllowedMentions` no Client ou `allowedMentions` no payload, sobretudo ao ecoar conteúdo externo ou de usuário. Mensagem que deve avisar uma pessoa (entrada de membro, teste do painel) usa `{ parse: [], users: [id] }`, só com o ID dela, nunca `parse: ['users']`; menção dentro de embed nunca notifica, então a menção que avisa vai no `content`. Em edits v10, `attachments` lista todos os arquivos que permanecerão. Uploads usam `multipart/form-data`, `payload_json` e `files[n]`; referências internas usam `attachment://filename`.

## Fontes

- [Deploying commands](https://discordjs.guide/legacy/app-creation/deploying-commands)
- [Application Commands](https://docs.discord.com/developers/interactions/application-commands)
- [Interaction responses](https://docs.discord.com/developers/interactions/receiving-and-responding)
- [Component Reference](https://docs.discord.com/developers/components/reference)
- [Using Modal Components](https://docs.discord.com/developers/components/using-modal-components)
- [Components V2](https://discordjs.guide/popular-topics/components-v2)
- [Collectors](https://discordjs.guide/legacy/popular-topics/collectors)
- [Message Resource](https://docs.discord.com/developers/resources/message)
