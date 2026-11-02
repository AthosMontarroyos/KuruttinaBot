# Importação e processamento de imagens de emoji

Última atualização: 16 de outubro de 2026.

Este documento descreve o núcleo compartilhado de importação de emojis e a integração do comando de servidor (`/emoji add` → `k!emoji-add`, no servidor onde o comando foi executado). `/dev emoji add` não cria Application Emojis: ele orienta o [workflow manual](emojis-prod.md). Esse workflow reutiliza o mesmo `createDiscordImageDownloader` e o mesmo `createSharpEmojiProcessor`, em memória, e não grava arquivo nem carrega o token de production no bot. O adapter do processo recusa o destino `application` e o bootstrap não autentica a credencial de production para isso. O serviço ainda conhece esse destino para os testes do núcleo. As permissões de `emoji add` ficam na rota e se somam à política raiz de `/emoji`. A consulta `/emoji info` não usa este pipeline e não baixa nem reenvia arquivos.

## Escopo desta etapa

Implementado:

- `apps/bot/src/application/emojis/types.ts`: contratos, limites, fila e códigos de erro.
- `apps/bot/src/application/emojis/imageSignature.ts`: reconhecimento de PNG, JPEG, GIF, WebP e AVIF pela assinatura, sem decodificar.
- `apps/bot/src/application/emojis/prepareEmojiImage.ts`: validação de entrada, assinatura antes do decodificador, chamada de compressão e defesas finais (limite de saída, preservação de animação, sanitização de erros genéricos).
- `apps/bot/src/application/emojis/importEmoji.ts`: serviço com fila, parsing de referências, derivação de nome, verificação de capacidade e fallback GIF→PNG.
- `apps/bot/src/infrastructure/images/downloadDiscordImage.ts`: download restrito ao CDN do Discord.
- `apps/bot/src/infrastructure/images/sharpEmojiProcessor.ts`: escada de compressão com `sharp` e redução de quadros com `gifenc`.
- `apps/bot/src/infrastructure/discord/emojis/emojiAdapter.ts`: criação de emojis de servidor via `discord.js`. O destino `application` é recusado; a criação no bot de produção é o workflow manual.
- `apps/bot/src/infrastructure/discord/emojis/emojiAdd.ts`: executor e leitura de entradas da importação no servidor, fora da descoberta de comandos.
- `apps/bot/src/commands/dev/emoji.ts` e `apps/bot/src/commands/mod/emoji.ts`: definições slash (subcomando e grupo), rotas por prefixo e políticas `staff`/`guild`. O módulo em `dev/` declara `scope: 'dev-guild'`, só é publicado nas guildas de desenvolvimento cadastradas e responde com a orientação do workflow. O módulo em `mod/` importa para o servidor.
- `apps/bot/src/bootstrap.ts`: uma única composição do serviço, injetada no dispatcher pelos dois transports.

Permissões e identidade ficam na política de acesso (ver [Acesso do bot](bot-access.md)). Não existe configuração por guild de limites ou fila; os limites são os de `DEFAULT_EMOJI_IMAGE_LIMITS`.

## Limites

Limite do Discord (invariante): **256 KiB** por emoji (`DISCORD_EMOJI_MAX_BYTES`), normalização de dimensão para caber em **128×128 sem ampliar** (`fit: 'inside'` + `withoutEnlargement`; ampliar um GIF com transparência corrompe o alfa no caminho animado do libvips).

Limites internos (`DEFAULT_EMOJI_IMAGE_LIMITS`, em `types.ts`):

| Limite | Valor |
| --- | --- |
| Entrada | 8 MiB |
| Pixels decodificados (largura × altura × quadros) | 16.000.000 |
| Quadros | 300 |
| Duração da animação | 15 s |
| Download | 15 s |
| Processamento | 20 s |
| Tentativas de codificação | 8 |

Fila (`DEFAULT_EMOJI_QUEUE_LIMITS`): concorrência 1, até 5 solicitações aguardando; excedente falha com `queue_full`.

## Escada de compressão

A escada tenta primeiro a melhor qualidade e só aumenta a agressividade enquanto a saída excedir 256 KiB, parando na primeira saída dentro do limite. Nunca converte animação em estático silenciosamente: um GIF que só ficaria dentro do limite desanimado falha com `animation_lost`.

- **Estático (PNG):** 5 etapas — PNG lossless e, em seguida, paletek 256/128/64/32 com dither decrescente.
- **Animado (GIF):** 5 etapas `sharp` (256/192/128/64/32 cores com `interFrameMaxError` crescente) e, como última instância, 2 etapas de redução de quadros via `gifenc` (manter 1/2 e 1/3 dos quadros, absorvendo o tempo dos quadros removidos no anterior mantido).

Transformações reportadas em `CompressedImage.transformations`: `normalized_128`, `palette_reduced`, `dithering_reduced`, `frames_reduced`.

Detalhes de implementação relevantes:

- O `gifenc` publica CJS (`main`) e ESM (`module`); o código usa `createRequire` para resolver o mesmo formato no Node do bot e no vitest.
- Antes da paletização com `gifenc`, pixels com alfa 0 têm RGB zerado: decodificadores de GIF preservam a cor da paleta sob o índice transparente e, sem a normalização, esses pixels empatam a distância contra a entrada transparente `[0,0,0,0]` e a animação perde transparência.
- `sharp.concurrency(1)` e cache reduzido limitam CPU/memória durante picos.

## Download

`downloadDiscordImage` só aceita `https`, porta 443, sem credenciais, hosts `cdn.discordapp.com`/`media.discordapp.net`, paths `/emojis`, `/attachments` (arquivo de mensagem) ou `/ephemeral-attachments` (arquivo da opção de slash command), sem redirects (`redirect: 'error'`) e com stream limitado a `maxBytes`. A leitura fica só em memória: nada é gravado em disco e o arquivo original nunca é reenviado. O Discord recebe apenas a imagem recodificada, em data URI. **Limitação registrada:** não há pinning de DNS — um resolve falsificado para o mesmo host ainda passaria na allowlist; o transporte TLS continua obrigatório.

Para emojis de guild e para o workflow de produção, `downloadDiscordEmojiById` consulta o CDN primeiro como `.gif?size=128&quality=lossless` e, se ausente, como `.png`, para nunca perder animação por adivinhar o formato. Um GIF que não existe volta HTTP 415 com `Invalid resource`, não 404; essa resposta conta como ausência e a tentativa segue para PNG. Uma URL HTTPS fora dessa allowlist não é buscada.

## Destinos e erros

`createEmojiImportService` aceita origem (referência de emoji `<:nome:id>`/`<a:nome:id>`, ID puro ou URL de anexo) e destino (`application` ou `guild`). Para `application`, a capacidade ainda é verificada no serviço antes (`DISCORD_APPLICATION_EMOJI_LIMIT` = 2000); para `guild`, a capacidade é deixada para o erro do Discord. O adapter de servidor envia data URI com MIME explícito (`image/png`/`image/gif`) pelo client ativo. No processo, o destino `application` falha fechado, sem token de production: a criação real está no workflow manual. Os códigos 30008/30018/30056 do destino de servidor mapeiam para `capacity_reached`.

O nome sai, nesta ordem, da opção `nome`, do nome real do arquivo (sem extensão), do segmento final da URL ou do nome embutido na referência do emoji. Antes de enfileirar, um tamanho declarado acima do limite de entrada falha com `input_too_large` sem consumir download — junto com a cota do destino, é a verificação de falha barata. Um `contentType` declarado fora de `image/` também recusa antes do download (`unsupported_format`); ausência, `null` e `image/*` não autorizam o arquivo.

Depois do download, e antes de `sharp`, `sniffImageFormat` exige a assinatura real de PNG, JPEG, GIF, WebP ou AVIF. Sem essa assinatura o decodificador não é chamado. Se o formato que o `sharp` reporta divergir da assinatura, a entrada falha com `corrupt_image`. Extensão e `Content-Type` nunca escolhem o formato aceito.

Todos os erros são `EmojiImportError` com `code` seguro para exibição: `empty_input`, `input_too_large`, `unsupported_format`, `corrupt_image`, `too_many_pixels`, `too_many_frames`, `duration_exceeded`, `processing_timeout`, `size_unreachable`, `animation_lost`, `queue_full`, `invalid_source`, `invalid_name`, `missing_source`, `invalid_input`, `download_blocked`, `download_failed`, `source_missing`, `destination_unavailable`, `capacity_reached`, `create_failed`. `missing_source` e `invalid_input` vêm da leitura das entradas pelo comando e nunca alcançam o download.

## Proveniência e licença

Importar um emoji de uma guild é reutilizar um asset externo. Conforme a regra de [proveniência e limpeza](../agents/assets.md#regra-proveniencia-e-limpeza), a responsabilidade de verificar licença/proveniência compatível é de quem executa a importação; o núcleo não automática essa verificação. A criação não copia binários para o repositório.

## Lacunas conhecidas (fora do escopo desta implementação)

1. Limites e fila são globais ao processo: não há configuração por guild nem entre shards.
2. A responsabilidade de licença/proveniência do asset importado permanece de quem executa a importação.
