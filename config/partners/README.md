# Partners

Use `partners.example.json` como modelo e copie-o para `partners.local.json` no desenvolvimento local. Partners usam somente `nome`, `id` e `permissao`; `id` é Snowflake string canônica (`^[1-9][0-9]{16,19}$`), a enum é case-sensitive (`Vip`, `Parceiro`, `Developer`, `Creator`) e há no máximo um `Creator`. O registry classifica guilds, não autentica nem autoriza usuários, e `Creator` não substitui `CREATOR_DISCORD_ID`.

Quando o parser for implementado, ele deve falhar fechado: aceitar objeto e campos exatos, strings sem coerção, IDs únicos e no máximo um `Creator`. Campo desconhecido, ID duplicado ou segundo `Creator` rejeita o arquivo inteiro; zero `Creator` não aciona fallback. Permissões por ação usam mapa explícito deny-by-default, nunca ordem lexical ou índice do enum. O arquivo não é gravável pelo bot/site e exemplos nunca são carregados como configuração real.
