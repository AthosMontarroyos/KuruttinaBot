---
name: project-operations
description: Configurar, diagnosticar ou revisar deploy Square Cloud, release, ambiente, memória e assets R2/Cloudflare do KuruttinaBot. Usar para operação e distribuição; UI e comandos isolados usam suas skills próprias.
---

# Operação do projeto

## Deploy, configuração e diagnóstico

1. Confira `squarecloud.app`, scripts do `package.json` e apenas o estado necessário em [desenvolvimento](../../../docs/project/development.md). O manifesto atual inicia o bot; a Home existe localmente, sem publicação confirmada.
2. Leia topologia em [deployment](references/deployment.md) para manifesto, ambiente, instalação ou START; persistência e recursos para migrations, memória, sinais, logs ou resiliência. Preserve a aplicação única enquanto não houver decisão substituta.
3. Prepare build pelo lockfile e testes do app afetado com sua skill. Verifique ferramentas necessárias em produção, configuração allowlisted, shutdown e ausência de secrets nos artefatos. Meça recursos antes de publicar mais um processo na mesma aplicação.
4. Para migration/release, use a skill de banco e credencial exclusiva de release, com lock e execução única. Nunca coloque credencial administrativa no runtime.
5. Execute publicação externa somente no escopo autorizado pelo usuário. Confirme ambiente, resultado e readiness; não afirme sucesso de deploy a partir de build local.

## Assets e Cloudflare

Leia [assets](references/assets.md) apenas para a operação: origem/acesso e integração para mídia R2; SVGs para ícones locais; proveniência/limpeza para assets externos. O bucket não é baixado nem espelhado no repositório. Scripts de R2, espelho de emojis e túnel foram aposentados; consulte o [registro](../../../docs/project/tooling-retirement.md) somente para investigar esses legados. Gerenciamento do bucket ocorre fora deste repositório.

Se alterar credenciais ou acesso operacional, leia secrets, least privilege e fronteira Supabase em [segurança](../project-maintenance/references/security.md), conforme o provedor. Documente procedimento reutilizável nesta skill e estado confirmado nos documentos do produto.
