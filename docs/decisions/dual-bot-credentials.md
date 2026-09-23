# ADR: credenciais Dev e Principal no mesmo ambiente

## Contexto

Comandos futuros do Bot Dev precisarão operar o Bot Principal. Isso exige que os dois tokens e IDs estejam disponíveis de forma tipada no mesmo `.env`, sem tornar a seleção ambígua.

O mesmo arquivo reserva os Client Secrets OAuth2 das duas aplicações. Eles não integram o contrato tipado do runtime enquanto nenhum fluxo OAuth2 os consumir.

## Decisão

`APP_ENV` aceita somente `development` ou `production`. A configuração valida sempre os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*`, expõe ambos como credenciais somente leitura e seleciona exatamente uma credencial ativa, sem fallback. A identidade ativa é validada por `/users/@me` antes do Gateway/deploy.

Esta é uma exceção explícita às regras anteriores de uma credencial por runtime e de execução do Bot Principal somente no Railway. A exceção foi solicitada e aprovada pelo responsável humano em 11 de setembro de 2026 para permitir múltiplos modos locais de execução e futuras operações do Bot Dev sobre o Bot Principal.

## Impacto e controles

O blast radius é crítico: uma seleção ou segredo incorreto pode operar o bot Principal. `.env` permanece ignorado pelo Git; logs não incluem tokens; não há fallback; a identidade é verificada. A leitura local seleciona as chaves do bot sem popular `process.env` com todo o arquivo. Credenciais administrativas e do n8n não entram no ambiente carregado pelo bot. Tokens devem ser rotacionados após exposição ou conforme política operacional.

O primeiro command cross-bot deve introduzir uma capability explícita e estreita, com autorização por operação, auditoria e testes negativos; não deve entregar o objeto global de credenciais ao command. Até esse consumidor existir, não crie service, repository ou camada vazia apenas para representar a capability futura.

Responsável: AthosMontarroyos.

## Remoção

Migrar para uma interface de capacidades e secret store quando os comandos cross-bot forem implementados; então remover o acesso conjunto ao `.env`.
