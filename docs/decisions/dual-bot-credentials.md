# ADR: credenciais Dev e Principal no mesmo ambiente

## Contexto

Comandos futuros do Bot Dev precisarão operar o Bot Principal. Isso exige que os dois tokens e IDs estejam disponíveis de forma tipada no mesmo `.env`, sem tornar a seleção ambígua.

O mesmo arquivo reserva os Client Secrets OAuth2 das duas aplicações. Eles não integram o contrato tipado do runtime enquanto nenhum fluxo OAuth2 os consumir.

## Decisão

`APP_ENV` aceita somente `development` ou `production`. A configuração valida sempre os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*`, expõe ambos como credenciais somente leitura e seleciona exatamente uma credencial ativa, sem fallback. A identidade ativa é validada por `/users/@me` antes do Gateway/deploy.

Esta é uma exceção explícita às regras anteriores de uma credencial por runtime e de execução do Bot Principal somente no Railway. A exceção foi solicitada e aprovada pelo responsável humano em 11 de setembro de 2026 para permitir múltiplos modos locais de execução e futuras operações do Bot Dev sobre o Bot Principal.

## Impacto e controles

O blast radius é crítico: uma seleção ou segredo incorreto pode operar o bot Principal. `.env` permanece ignorado pelo Git; logs não incluem tokens; não há fallback; a identidade é verificada. A leitura local seleciona as chaves do bot sem popular `process.env` com todo o arquivo. Credenciais administrativas não entram no ambiente carregado pelo bot. Tokens devem ser rotacionados após exposição ou conforme política operacional.

O primeiro command cross-bot deve introduzir uma capability explícita e estreita, com autorização por operação, auditoria e testes negativos; não deve entregar o objeto global de credenciais ao command. Até esse consumidor existir, não crie service, repository ou camada vazia apenas para representar a capability futura.

Responsável: AthosMontarroyos.

## Atualização — 28 de setembro de 2026

`/dev emoji add` é a primeira operação cross-bot. A composição entrega à capability somente a credencial de production. Ela confirma `/users/@me` antes de listar ou criar Application Emojis por REST e não abre Gateway para essa credencial. O command continua sem o objeto global de credenciais. Falha de identidade não é reaproveitada; sucesso fica em cache no processo. A auditoria registra a aplicação, o emoji criado e os snowflakes de autor e guilda, sem token nem imagem.

## Remoção

Quando existir um secret store para esta capability, remover o acesso conjunto ao `.env`. Até lá, o processo continua lendo os dois pares e a capability recebe só a credencial de production.
