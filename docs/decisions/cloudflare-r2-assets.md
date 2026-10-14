# ADR: assets compartilhados no Cloudflare R2

Status — 14 de outubro de 2026: **vigente** como origem de assets. A revisão de provedor no [replanejamento](../project/replanning.md) não foi executada; a mudança para a VPS não altera bucket, domínio nem objetos. O limite de pacote da Square Cloud citado abaixo é contexto histórico. Números e comparações da época precisam de nova verificação se o provedor for reavaliado.

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

- Manter `Pictures/` no Git ou no pacote da antiga Square Cloud: o volume excedia o limite de deploy daquela hospedagem.
- Duplicar assets no bot e no site: aumenta tamanho e permite divergência.
- Supabase Storage: funciona, mas sua franquia de transferência é menos adequada aos GIFs públicos acessados repetidamente.

Responsável: AthosMontarroyos.

## Revisão

Reavaliar ao atingir limites medidos do R2, precisar de assets privados ou quando o domínio próprio for conectado.
