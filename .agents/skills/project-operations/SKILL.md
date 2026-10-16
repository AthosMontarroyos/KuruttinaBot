---
name: project-operations
description: Configurar, diagnosticar ou revisar a VPS KingHost, Docker, Compose, contêineres, systemd legado, release, Cloudflare Tunnel, ambiente, memória e assets R2 do KuruttinaBot. Usar para operação e distribuição; UI e comandos isolados usam suas skills próprias.
---

# Operação do projeto

## Deploy, configuração e diagnóstico

1. Leia [deployment](references/deployment.md), os scripts do `package.json` e apenas o estado necessário em [desenvolvimento](../../../docs/project/development.md) e no [estado atual](../../../docs/project/current-state.md). Leia as unidades em `ops/systemd/` somente quando a tarefa envolver o runtime legado. Separe o contrato do repositório da operação ainda não verificada na VPS.
2. Mantenha bot e Home como processos Node separados. O empacotamento vigente é o `Dockerfile` com os alvos `bot`, `site` e `release`, o `compose.yaml` de produção e o `compose.dev.yaml` de desenvolvimento. Os procedimentos ficam na referência de deployment. Não reintroduza `squarecloud.app`, launchers locais de túnel, Prometheus, exporters, healthchecks novos nem infraestrutura de logs. As unidades em `ops/systemd/` permanecem o runtime anterior até a troca explícita pelo painel.
3. Prepare as imagens em Linux compatível com a VPS, na linha Node 24, pelo lockfile, dentro do build. Não transporte `node_modules` do Windows. Verifique o app afetado com a skill correspondente, shutdown, configuração allowlisted e ausência de secrets nos artefatos. Não publique na VPS sem pedido explícito.
4. Para migration/release, use a skill de banco e a credencial exclusiva de release, com lock e execução única. Nunca coloque credencial administrativa, token do túnel ou variáveis do outro serviço no runtime. O `.env` da raiz é a única origem; cada serviço do Compose declara só as suas variáveis. Os processos da imagem usam o usuário `node` já existente na base.
5. Execute publicação externa somente no escopo autorizado pelo usuário. Não dispare os workflows de release nem de comandos sem esse pedido. Confirme ambiente, `/healthz`, página, asset, serviço ativo e readiness do bot. Não afirme sucesso de deploy a partir de build local. Meça a RAM agregada antes de considerar a publicação concluída.

## Assets e Cloudflare

Leia [assets](references/assets.md) apenas para a operação: origem/acesso e integração para mídia R2; SVGs para ícones locais; proveniência/limpeza para assets externos. O bucket não é baixado nem espelhado no repositório. Scripts de R2, espelho de emojis e o launcher local de túnel foram aposentados; consulte o [registro](../../../docs/project/tooling-retirement.md) somente para investigar esses legados. O túnel de produção é `cloudflared` com configuração remota, no contrato de [deployment](references/deployment.md). Gerenciamento do bucket ocorre fora deste repositório.

Se alterar credenciais ou acesso operacional, leia secrets, least privilege e fronteira Supabase em [segurança](../project-maintenance/references/security.md), conforme o provedor. Documente procedimento reutilizável nesta skill e estado confirmado nos documentos do produto.
