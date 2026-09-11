# Configuração

- [Emojis](emojis/README.md): tokens e metadados dos vaults de emojis.
- [Partners](partners/README.md): servidores, IDs e permissões do registry.

Emojis usam `token`, `nome`, `categoria` e `descricao` opcional. Partners usam somente `nome`, `id` e `permissao`; `id` é Snowflake string canônica (`^[1-9][0-9]{16,19}$`), a enum é case-sensitive (`Vip`, `Parceiro`, `Developer`, `Creator`) e há no máximo um `Creator`. O registry classifica guilds, não autentica nem autoriza usuários, e `Creator` não substitui `CREATOR_DISCORD_ID`.

Em produção, a fonte deve ser server-side, controlada e auditável, sem fallback para os exemplos. Arquivos `.local.json` e arbitrários permanecem ignorados pelo Git.
