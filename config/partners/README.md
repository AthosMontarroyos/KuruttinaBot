# Partners

Use `partners.example.json` como modelo e copie-o para `partners.local.json` no desenvolvimento local. Partners usam somente `nome`, `id` e `permissao`; `id` é Snowflake string canônica (`^[1-9][0-9]{16,19}$`), a enum é case-sensitive (`Vip`, `Parceiro`, `Developer`, `Creator`) e há no máximo um `Creator`. O registry classifica guilds, não autentica nem autoriza usuários, e `Creator` não substitui `CREATOR_DISCORD_ID`.
