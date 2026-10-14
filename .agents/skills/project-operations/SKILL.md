---
name: project-operations
description: Configurar, diagnosticar ou revisar a VPS KingHost, systemd, release, Cloudflare Tunnel, ambiente, memória e assets R2 do KuruttinaBot. Usar para operação e distribuição; UI e comandos isolados usam suas skills próprias.
---

# Operação do projeto

## Deploy, configuração e diagnóstico

1. Leia [deployment](references/deployment.md), as unidades em `ops/systemd/`, os scripts do `package.json` e apenas o estado necessário em [desenvolvimento](../../../docs/project/development.md) e no [estado atual](../../../docs/project/current-state.md). Separe o contrato do repositório da operação ainda não verificada na VPS.
2. Mantenha bot e Home como serviços Node separados, com build antes da ativação. Não reintroduza `squarecloud.app`, Docker/Compose nem launchers locais de túnel.
3. Prepare o release em Linux compatível com a VPS, na linha Node 24, pelo lockfile. Não transporte `node_modules` do Windows. Verifique o app afetado com a skill correspondente, shutdown, configuração allowlisted e ausência de secrets nos artefatos.
4. Para migration/release, use a skill de banco e a credencial exclusiva de release, com lock e execução única. Nunca coloque credencial administrativa, token do túnel ou variáveis do outro serviço no runtime.
5. Execute publicação externa somente no escopo autorizado pelo usuário. Confirme ambiente, `/healthz`, página, asset, serviço ativo e readiness do bot. Não afirme sucesso de deploy a partir de build local. Meça a RAM agregada antes de considerar a publicação concluída.

## Assets e Cloudflare

Leia [assets](references/assets.md) apenas para a operação: origem/acesso e integração para mídia R2; SVGs para ícones locais; proveniência/limpeza para assets externos. O bucket não é baixado nem espelhado no repositório. Scripts de R2, espelho de emojis e o launcher local de túnel foram aposentados; consulte o [registro](../../../docs/project/tooling-retirement.md) somente para investigar esses legados. O túnel de produção é `cloudflared` com configuração remota, no contrato de [deployment](references/deployment.md). Gerenciamento do bucket ocorre fora deste repositório.

Se alterar credenciais ou acesso operacional, leia secrets, least privilege e fronteira Supabase em [segurança](../project-maintenance/references/security.md), conforme o provedor. Documente procedimento reutilizável nesta skill e estado confirmado nos documentos do produto.
