# Gateway, REST e escala

## Gateway v10

Deixe `discord.js` cuidar de heartbeat, identify, resume e close codes, mas torne desconexões observáveis e não bloqueie o event loop.

- Payload enviado: 4096 bytes; 120 eventos enviados/conexão/60 s.
- `IDENTIFY`: emergência global de 1000/24 h, excluindo `RESUME`.
- Consulte `GET /gateway/bot` para limites de sessão e `max_concurrency`.
- Falta de `HEARTBEAT_ACK` exige reconexão/resume.
- Intents inválidos/não autorizados fecham a conexão.

`REQUEST_GUILD_MEMBERS` completo exige `GuildMembers`; presences exigem `GuildPresences`. Busca aceita 100 IDs/resultados, chunks até 1000 membros e lista completa 1 pedido/guild/bot/30 s.

## REST

Use `client.rest` ou `new REST().setToken()`. Instrumente `RESTEvents.RateLimited`, `InvalidRequestWarning` e `Response`. Respeite todos os headers de rate limit.

- Global padrão: 50 req/s, além de buckets por rota.
- Interaction webhooks têm buckets próprios e não contam no global do bot.
- 10.000 respostas inválidas por IP/10 min acionam limite específico.
- Não hardcode limites por rota nem sobreponha retries aos do REST manager.

## Sharding

Obrigatório a partir de 2500 guilds. Distribuição: `(guild_id >> 22) % num_shards`; eventos sem `guild_id` chegam ao shard 0. Use o total recomendado por `GET /gateway/bot` e buckets `shard_id % max_concurrency` em janelas de 5 s.

`shards: 'auto'` usa um processo; `ShardingManager` separa processos/workers. Memória e caches são isolados, portanto estado global, locks, filas e jobs exigem coordenação externa. Acima de 150.000 guilds, siga large-bot sharding atribuido pelo Discord.

## Webhooks e HTTP interactions

Tokens de webhook são segredos. Use `wait=true` quando precisar confirmar persistência. Não reutilize webhook após 404.

Gateway e endpoint HTTP de interactions são mutuamente exclusivos. Em HTTP, valide Ed25519 com os headers de assinatura sobre o corpo bruto; Discord envia assinaturas inválidas de teste. ACK em 3 s. Webhook Events não são realtime nem ordenados; responda PING com 204 vazio.

## Voice

Voice é opcional. Instale `@discordjs/voice`, confira requisitos e habilite `GuildVoiceStates`. Modele connection, player e resource separadamente; trate erro, idle e reconexão. Receber/gravar áudio não é documentado pelo Discord e não tem estabilidade garantida.

## Fontes

- [Gateway](https://docs.discord.com/developers/events/gateway)
- [Gateway Events](https://docs.discord.com/developers/events/gateway-events)
- [Sharding](https://discordjs.guide/legacy/sharding)
- [Rate Limits](https://docs.discord.com/developers/topics/rate-limits)
- [discord.js REST](https://discord.js.org/docs/packages/rest/main)
- [Webhook Resource](https://docs.discord.com/developers/resources/webhook)
- [Webhook Events](https://docs.discord.com/developers/events/webhook-events)
- [discord.js voice](https://discord.js.org/docs/packages/voice/main)
