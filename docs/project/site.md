# Home local

A primeira Home foi adaptada dos frames desktop e celular do [Figma](https://www.figma.com/design/GQNMJgri0cuH6IuiFSJ6Qx/Kuruttina-Home?node-id=0-1). O código está em `apps/site`. Layout, proveniência dos ícones e imagem provisória estão em [referência visual](../../.ui/home-figma.md).

Com as dependências instaladas pelo lockfile (`npm ci`), configure no `.env` da raiz `APP_ENV=development`, `PORT=3666` e `ASSETS_BASE_URL` com a origem HTTPS pública do bucket. Execute `npm run site:dev` e abra `http://127.0.0.1:3666`. O processo é separado do bot, escuta apenas loopback e não inicia Discord ou banco.

A interface está em React, TypeScript e Tailwind, organizada como `src/app` e `src/components`. O processo HTTP fica em `server/`. `npm run site:build` limpa somente `apps/site/dist`, gera o bundle com Vite e compila o servidor Node. `npm run site:start` executa esse build; reinicie após alterações. `npm run typecheck` verifica o servidor e os componentes, e `npm test` inclui os testes HTTP/configuração, sem ler `.env` operacional.

A composição valida ambiente, porta e URL de assets no startup. A página carrega `icons/Icons/1.jpg` diretamente do R2, tanto no avatar quanto no retrato. Para trocar a imagem, altere a chave relativa em `apps/site/server/config.ts`. Nenhuma credencial Cloudflare entra no processo ou no browser. A fonte Outfit é carregada pelo Google Fonts; se indisponível, há fallback sans-serif. Falha de mídia mostra alternativa textual no retrato.

A troca de tema funciona com armazenamento local opcional. Comandos, módulos, termos, convite, painel, conta e redes sociais ainda precisam de conteúdo/integração; seus controles informam essa indisponibilidade. A Home não implementa autenticação nem operações administrativas.

Publicação não realizada. O site é uma base visual local para ajuste; a decisão de hospedagem, supervisão conjunta com o bot, recursos e revisão do manifesto continuam pré-requisitos de deploy. O servidor expõe somente arquivos públicos allowlisted e `/healthz`, com GET/HEAD, CSP, timeout HTTP e encerramento limitado após sinais. Nenhuma configuração de produção foi alterada.
