# ADR: VPS KingHost para bot e Home; Supabase preservado

Status — 15 de outubro de 2026: **vigente** para hospedagem. A execução passa a ser Docker Compose, gerenciado pelo painel externo quando a VPS for ativada. Esta atualização não afirma que a migração na máquina ocorreu. Substitui a topologia Square Cloud do [ADR anterior](square-cloud-supabase.md) e a escolha de execução de 14 de outubro de 2026, resumida abaixo.

## Contexto

O produto tem bot Discord e Home local em processos Node separados. A hospedagem anterior era uma aplicação Square Cloud, com manifesto removido do checkout. O responsável definiu produção no Ubuntu 24.04 da KingHost e publicação da Home por Cloudflare Tunnel no host. Supabase e R2 permanecem os provedores atuais. Não há pipeline de deploy neste repositório. O painel externo deve aceitar Compose com build local e o `.env` da raiz do checkout para interpolação.

## Decisão

Bot e Home rodam na mesma VPS como contêineres distintos, construídos do checkout pelos alvos `bot` e `site`. O processo usa o usuário não administrativo `node` já existente na imagem base. A linha é Node 24. Dentro do contêiner a Home escuta `0.0.0.0`; o host publica somente `127.0.0.1:3666`. `cloudflared` permanece no host, com configuração gerenciada na Cloudflare, e publica `kuruttina.athosmontarroyos.com` nesse endereço. Há uma instância de cada aplicação Discord. O contrato de publicação aceita uma breve interrupção no restart. Falha na preparação não troca a versão ativa. Falha na primeira ativação para os contêineres e devolve a execução às unidades anteriores. Rollback de código não desfaz migrations.

A configuração de produção e de desenvolvimento é um único `.env` na raiz do checkout. O Compose entrega a cada serviço somente as variáveis necessárias. Bot e Home não recebem token do túnel nem credencial administrativa de migration. As duas credenciais Discord do bot continuam exigidas pelo contrato atual. A credencial de migration pode ficar vazia até essa operação; a validação existente impede só a migration e não usa a credencial de runtime. No Linux, o arquivo fica restrito ao proprietário do deploy. Conta `kuruttina` e arquivos em `/etc/kuruttina/` não são pré-requisito do Compose. O que já existir na VPS não é apagado por esta decisão. As unidades systemd que ainda citam esses caminhos são o runtime anterior. A [decisão de login exclusivamente via Discord](discord-only-authentication.md), inclusive os privilégios em `bot_private.bot_staff`, permanece independente da configuração de execução.

Preserva-se o que continua válido do ADR anterior: projetos Supabase distintos para development e production, PostgreSQL descartável para testes, migration uma vez por release com credencial administrativa exclusiva, role de runtime de menor privilégio e R2 sem mudança de contrato.

## Escolha anterior — 14 de outubro de 2026

Naquela data, a execução vigente era bot e Home como serviços `systemd` distintos, com a Home escutando diretamente `127.0.0.1:3666`, releases imutáveis em `/opt/kuruttina/releases/<commit>` e ausência de Docker/Compose herdada do ADR Square Cloud. Essa escolha de execução foi substituída em 15 de outubro de 2026. As unidades em `ops/systemd/` e o release anterior em disco permanecem previstos para recuperação até a troca ser aceita. A ausência de Docker/Compose não faz parte da decisão vigente.

## Consequências e controles

- Bot e Home podem reiniciar separados; o túnel não acompanha o ciclo dos processos Node. Os dois serviços ainda compartilham a máquina, então falta de memória ou disco afeta ambos.
- Tokens do túnel, credencial de migration e credenciais administrativas não entram nos processos permanentes. O site de produção recebe só as variáveis da Home, com `HOST` e porta fixados pelo Compose.
- A porta HTTP não é publicada para acesso externo direto. O bot segue conectado ao Discord sem o túnel e sem porta HTTP.
- Mudança de banco incompatível com o código anterior exige procedimento próprio, porque o rollback de release não reverte schema.
- Memória agregada continua com teto operacional de 70% em uso estável e picos abaixo de 90%. Essa medição ainda não foi feita na VPS. RAM e logs no painel ADM continuam intenção futura, sem integração implementada.
- Antes de ativar o hostname, confira conectores. A origem de produção foi alinhada depois da decisão de 14 de outubro; o estado verificado está no [inventário](../project/cloudflare-tunnel.md). Conector que ainda aponte para outra origem não pode permanecer ativo.

Responsável: Athos Montarroyos.
