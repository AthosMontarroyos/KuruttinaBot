# Estado atual do KuruttinaBot

Última consolidação: 28 de setembro de 2026.

O monorepo implementa um bot Discord em TypeScript/ESM, `packages/config` e `packages/database`. **O site ainda não existe.** O bot usa `discord.js` 14.27.0, commands slash e prefixos `k!`/`K!`, PostgreSQL/Supabase para cadastro da equipe e duas aplicações Discord selecionadas por `APP_ENV`. As duas credenciais Discord são exigidas pelo contrato atual; somente a aplicação ativa abre Gateway e publica comandos. Veja [Acesso do bot](bot-access.md) e [Importação de emojis](emoji-import.md).

`apps/bot/src/bootstrap.ts` compõe Client, banco, handlers e adapters. Os commands ficam em `public/`, `mod/` e `dev/`; `dev/` é restrito à guilda da equipe. O catálogo valida política de acesso e escopo, e a publicação usa conjuntos global e de guilda. O bot valida identidade no Discord antes do Gateway e sincroniza commands no startup somente com `AUTO_SYNC_COMMANDS=true`. `/dev emoji add` cria Application Emojis na aplicação de production por REST, com a credencial de produção confirmada de novo antes da primeira operação; o Gateway continua só na credencial ativa. Shutdown drena comandos e fecha Client/pool com timeout.

`packages/database` implementa acesso PostgreSQL, migrations versionadas, role runtime de menor privilégio e RLS. Development e production usam projetos Supabase diferentes; integração automatizada usa cluster PostgreSQL descartável. A migration administrativa tem lock transacional e checksum. O bucket R2 permanece origem operacional de assets; as ferramentas locais de gerenciamento e sincronização de emojis foram removidas, sem automação substituta no projeto. As ferramentas aposentadas estão [inventariadas](tooling-retirement.md).

A raiz contém o único `squarecloud.app`, com bot como processo atual. O comando de build compila o bot antes do start. O futuro site compartilhará essa aplicação como processo separado após implementação e medição de recursos. Docker, Compose e o pacote opcional de automação foram retirados.

Execução local: Node 22.14+/24/26 para o bot, `npm ci`, `.env` na raiz, `npm run dev`; para produção equivalente, `npm run build` e `npm start`. O CI faz typecheck, testes, integração PostgreSQL, build e Gitleaks. A referência operacional atual é a [documentação de desenvolvimento](development.md), e a arquitetura decidida está no [ADR](../decisions/square-cloud-supabase.md).
