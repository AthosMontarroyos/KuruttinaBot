# Cloudflare Tunnel — operação e estado

Atualizado em 12/09/2026. Conta correta: `d529eedaae68663504591193e3c8c556`.

## Recursos criados

| Ambiente | Túnel | ID | Hostname solicitado |
|---|---|---|---|
| development | kuruttina-development | ef7d23f9-b164-45a1-b316-f45a02045102 | kuruttina.dev.athosmontarroyos.com |
| production | kuruttina-production | b1460ee3-03f7-49e7-a35c-12d6a6f07ba7 | kuruttina.athosmontarroyos.com |

O painel confirmou os dois recursos na conta correta e criou as rotas publicadas para `http://localhost:3666`. Os CNAMEs apontam para o UUID correspondente em `cfargotunnel.com`. Os túneis permanecem inativos enquanto nenhum connector estiver em execução; o site ainda não existe.

O bucket `kurrutina-bot-pictures` também foi recriado nessa conta. Os 135 arquivos (173.122.894 bytes no backup) foram restaurados, preservando os caminhos canônicos. A URL pública provisória é `https://pub-271b6233fa924c46b0aa8664e8587f3f.r2.dev`.

## Configuração local implementada

- `APP_ENV=development|production` substitui `BOT_TARGET` em bot, Compose e scripts. Seleção obrigatória, sem fallback; `NODE_ENV` não seleciona credenciais. O `.env` local foi migrado sem alterar secrets.
- `@kuruttina/config` contém o contrato compartilhado. `PORT` aceita 1–65535 e assume 3666; host local é `localhost`.
- `infra/cloudflare/tunnels.json` registra IDs e hostnames esperados; não configura a conta remotamente.
- `npm run tunnel:check` mostra apenas dados públicos do ambiente selecionado. `npm run tunnel:production -- --check` verifica produção sem conectar.
- `npm run tunnel` usa `APP_ENV`; `npm run tunnel:development` e `npm run tunnel:production` sobrescrevem o modo somente no processo iniciado.
- O launcher usa `CLOUDFLARE_TUNNEL_TOKEN_DEVELOPMENT` ou `CLOUDFLARE_TUNNEL_TOKEN_PRODUCTION` no `.env` global local e nas variáveis protegidas da plataforma de deploy. Cada valor contém somente o token do respectivo connector, obtido no painel, nunca o comando inteiro. A seleção verifica o ID embutido no token antes de iniciar `cloudflared`; a Cloudflare valida sua autenticidade.
- O connector recebe somente variáveis básicas do sistema e o token selecionado, sem herdar credenciais Discord. Não enviar tokens no chat.

Execute os comandos na raiz. `cloudflared` já está instalado. O site ainda não existe; `PORT` não inicia servidor. O bot usa Gateway de saída e não precisa de hostname HTTP.

## Pendências para ativação

1. Conferir certificado para `kuruttina.dev.athosmontarroyos.com`: o painel alerta que subdomínio em múltiplos níveis pode exigir o Advanced Certificate Manager.
2. Implementar/iniciar a origem web, iniciar o connector e verificar status Healthy, DNS, HTTPS e resposta de aplicação. Não usar ambos os túneis simultaneamente contra a mesma origem. Ambientes simultâneos requerem hosts/namespaces ou portas diferentes; atualizar a rota remota junto com `PORT`.
3. Trocar o endpoint `r2.dev` por domínio próprio antes do uso de produção sustentado.

Túneis são gerenciados remotamente: alterar `PORT` no `.env` não altera Service URL no painel. A hospedagem planejada em Square Cloud permanece; estes recursos não representam deploy executado nem mudança de provedor.

## Validação e rollback

Typecheck, build e 41 testes herméticos passaram. Os checks de ambos os ambientes retornaram IDs e origem esperados. Não houve login Discord, publicação de commands ou teste HTTP externo. Node local 26.7.0 gerou aviso por diferir do 22.14.x declarado; Docker não foi validado.

Para interromper um connector iniciado em foreground, use Ctrl+C. Para desfazer a migração de código, restaure a revisão anterior e renomeie `APP_ENV` para `BOT_TARGET` no runtime correspondente em conjunto. Recursos Cloudflare só devem ser removidos após confirmar ausência de uso; nenhuma exclusão foi executada.

Referências: [configuração Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/) e [limitações do Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/limitations/#full-setup).
