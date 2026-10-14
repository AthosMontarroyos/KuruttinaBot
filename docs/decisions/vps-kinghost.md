# ADR: VPS KingHost para bot e Home; Supabase preservado

Status — 14 de outubro de 2026: **vigente** para hospedagem. Substitui a topologia Square Cloud do [ADR anterior](square-cloud-supabase.md). A VPS, o DNS e os túneis remotos não foram inspecionados nesta decisão; o que está no repositório é o contrato, não a comprovação da máquina.

## Contexto

O produto tem bot Discord e Home local em processos Node separados. A hospedagem anterior era uma aplicação Square Cloud, com manifesto removido do checkout. O responsável definiu produção no Ubuntu 24.04 da KingHost, desenvolvimento nativo no Windows e publicação da Home por Cloudflare Tunnel. Supabase e R2 permanecem os provedores atuais. Não há pipeline de deploy neste repositório; a automação seguirá o contrato operacional.

## Decisão

Bot e Home rodam na mesma VPS como serviços `systemd` distintos, com usuário sem privilégio administrativo, Node 24 e entrypoints já compilados. A Home escuta `127.0.0.1:3666` e é publicada em `kuruttina.athosmontarroyos.com` por `cloudflared` independente, com configuração gerenciada na Cloudflare. Releases imutáveis ficam em `/opt/kuruttina/releases/<commit>`, com `current` apontando para a versão ativa. Configuração de produção fica em `/etc/kuruttina/`, fora dos releases e separada por serviço.

O contrato de publicação aceita uma breve interrupção no restart. Há uma instância do bot. Falha na preparação não troca a versão ativa. Falha na validação restaura o release anterior de código. Rollback de código não desfaz migrations.

Preserva-se o que continua válido do ADR anterior: projetos Supabase distintos para development e production, PostgreSQL descartável para testes, migration uma vez por release com credencial administrativa exclusiva, role de runtime de menor privilégio e ausência de Docker/Compose. R2 não muda. O `.env` local e as duas credenciais Discord do bot permanecem o contrato de desenvolvimento.

## Consequências e controles

- Bot e Home podem reiniciar separados; o túnel não acompanha o ciclo dos processos Node. Os dois serviços ainda compartilham a máquina, então falta de memória ou disco afeta ambos.
- Tokens do túnel, credencial de migration e credenciais administrativas não entram nos processos Node. O site de produção recebe só as variáveis da Home.
- A porta HTTP não é publicada para acesso externo direto. O bot segue conectado ao Discord sem o túnel.
- Mudança de banco incompatível com o código anterior exige procedimento próprio, porque o rollback de release não reverte schema.
- Memória agregada continua com teto operacional de 70% em uso estável e picos abaixo de 90%. Essa medição ainda não foi feita na VPS.
- Antes de ativar o hostname, confira conectores. A origem de produção foi alinhada depois desta decisão; o estado verificado está no [inventário](../project/cloudflare-tunnel.md). Conector que ainda aponte para outra origem não pode permanecer ativo.

Responsável: Athos Montarroyos.
