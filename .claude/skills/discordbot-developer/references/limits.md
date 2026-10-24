# Limites oficiais de referência

Valores conferidos em 2026-09-07. Não substituem headers REST, `GET /gateway/bot`, `attachment_size_limit`, changelog nem docs da versão instalada.

## Gateway e escala

| Item | Limite |
|---|---:|
| Payload Gateway enviado | 4096 bytes |
| Eventos enviados por conexão | 120 / 60 s |
| Identify de emergência | 1000 / 24 h |
| Identify por bucket | `max_concurrency` / 5 s |
| Guilds por shard | 2500 |
| `large_threshold` | 50–250 |
| Busca de guild members | 100 IDs/resultados |
| Chunk de members | 1000 |
| Lista completa de members | 1 / guild / bot / 30 s |

## Commands e interactions

| Item | Limite |
|---|---:|
| Resposta inicial | 3 s |
| Validade do interaction token | 15 min |
| Follow-ups user-installed fora da guild | 5 |
| Global chat-input commands | 100 |
| Global user/message commands | 15 cada |
| Global primary entry point | 1 |
| Command creates por guild | 200/dia |
| Nome/descrição de command | 1–32 / 1–100 chars |
| Options por nível | 25 |
| Choices/autocomplete results | 25 |
| Choice string | 100 chars |
| String option configurável | 0–6000 chars |
| Attachment `file_types` | 10 |
| Tamanho lógico do slash command | 8000 chars |
| Overwrites de command por guild | 100 |

`choices` e `autocomplete` são mutuamente exclusivos. Subcommands aninham um nível; com subcommands, o command-base não é invocável.

## Components e modals

| Item | Limite |
|---|---:|
| Components V2 por mensagem | 40 |
| Action Rows legadas | 5 |
| Buttons/selects por Action Row | 5 / 1 |
| `custom_id` | 1–100 chars |
| Button label/link URL | 80 / 512 chars |
| String select options | 25 |
| Select min/max | 0–25 |
| Select label/value/description | 100 chars cada |
| Select placeholder | 150 chars |
| Modal title | 45 chars |
| Componentes de topo no modal | 1–5 |
| Text input value/placeholder | 4000 / 100 chars |
| Label label/description | 45 / 100 chars |
| File upload no modal | 0–10 arquivos |
| Radio/checkbox group options | 10 |

## Mensagens, embeds e arquivos

| Item | Limite |
|---|---:|
| Message content | 2000 chars |
| Rich embeds / texto total | 10 / 6000 chars |
| Embed title/description | 256 / 4096 chars |
| Fields por embed | 25 |
| Field name/value | 256 / 1024 chars |
| Footer/author | 2048 / 256 chars |
| Stickers legados | 3 |
| Request Create Message | 25 MiB |
| Arquivo default | 10 MiB; confira contexto |
| IDs em `allowed_mentions.users/roles` | 100 cada |
| Bulk delete | 2–100 mensagens |

## REST e monetização

| Item | Limite |
|---|---:|
| Global padrão de bot | 50 req/s |
| Requests inválidos por IP | 10.000 / 10 min |
| SKUs por app | 50 |
| SKU name/description | 80 / 160 chars |
| Benefits | 6 |
| Benefit name/description | 80 / 160 chars |

Limites REST por rota são dinâmicos: use headers e o REST manager.

## Fontes

- [API Reference](https://docs.discord.com/developers/reference)
- [Gateway](https://docs.discord.com/developers/events/gateway)
- [Application Commands](https://docs.discord.com/developers/interactions/application-commands)
- [Interaction responses](https://docs.discord.com/developers/interactions/receiving-and-responding)
- [Component Reference](https://docs.discord.com/developers/components/reference)
- [Message Resource](https://docs.discord.com/developers/resources/message)
- [Rate Limits](https://docs.discord.com/developers/topics/rate-limits)
