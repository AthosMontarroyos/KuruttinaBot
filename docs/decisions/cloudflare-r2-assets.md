# ADR: assets compartilhados no Cloudflare R2

Status — 11 de outubro de 2026: **em revisão** pelo [replanejamento](../project/replanning.md). A decisão abaixo permanece como registro e contrato operacional atual. Provedor, distribuição e gestão de assets serão reavaliados; nenhum objeto, bucket ou domínio foi alterado. Números e comparações no contexto original são históricos e precisam de nova verificação na comparação técnica.

## Contexto

Os 135 arquivos de imagem ocupavam aproximadamente 165 MB, acima do limite real de 100 MB do pacote da Square Cloud. Bot e futuro site precisam acessar os mesmos arquivos sem duplicá-los nos respectivos builds.

## Decisão

O bucket R2 `kurrutina-bot-pictures` é a origem operacional compartilhada. Features que consomem mídia recebem uma `ASSETS_BASE_URL` HTTPS e armazenam somente caminhos relativos; processos sem consumidor não recebem a variável. `Pictures/` não é versionada; o backup fora do repositório permanece sob responsabilidade do mantenedor. Não há automação de gerenciamento de R2 neste projeto; veja o [registro de ferramentas aposentadas](../project/tooling-retirement.md).

O endpoint público `r2.dev` atende provisoriamente. Antes do uso de produção sustentado, o bucket deve receber um domínio próprio para cache e confiabilidade adequados.

## Impacto e controles

- Bot e site fazem leitura pública sem chaves do R2 no runtime.
- Somente assets aprovados para exposição pública entram no bucket.
- Nomes e caminhos são estáveis; substituições incompatíveis usam nova chave ou versionamento.
- Upload e exclusão exigem acesso administrativo fora do runtime e preservação do backup externo.
- Falha do R2 degrada apenas a exibição de mídia e não cria fila ou cache ilimitado no processo.

## Alternativas rejeitadas

- Manter `Pictures/` no Git ou no pacote Square: excede o limite de deploy.
- Duplicar assets no bot e no site: aumenta tamanho e permite divergência.
- Supabase Storage: funciona, mas sua franquia de transferência é menos adequada aos GIFs públicos acessados repetidamente.

Responsável: AthosMontarroyos.

## Revisão

Reavaliar ao atingir limites medidos do R2, precisar de assets privados ou quando o domínio próprio for conectado.
