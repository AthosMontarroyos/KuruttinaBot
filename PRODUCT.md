# KuruttinaBot — contexto do produto

<!-- impeccable:product-schema 1 -->

Contexto consolidado em 12 de outubro de 2026. Público prioritário e estado do diferencial confirmados pelo responsável nesta data. Este registro orienta decisões de produto; os documentos vinculados continuam sendo a fonte dos contratos técnicos e dos briefs de cada superfície.

## Platform

web

Este valor descreve a futura interface web no contexto do Impeccable. O produto implementado é um bot para Discord; há uma primeira Home local em `apps/site`, baseada no Figma; o painel administrativo ainda não está implementado.

## Users

Administradores e moderadores de servidores Discord são o público prioritário nas decisões de produto. Membros das comunidades também utilizam o bot, sem substituir essa prioridade.

## Product Purpose

Oferecer um bot multifuncional para comunidades Discord, com identidade própria e evolução orientada pelas necessidades dos servidores. As capacidades atuais de moderação e emojis não limitam o propósito do produto.

As próximas funcionalidades, sua ordem e os critérios mensuráveis de sucesso permanecem em definição.

## Positioning

O diferencial permanece em definição. Não apresentar abrangência, personalidade ou capacidades planejadas como vantagem competitiva comprovada.

Loritta é uma referência de abrangência registrada no replanejamento, sem autorizar cópia de identidade, funcionalidades ou arquitetura.

## Operating Context

O uso atual ocorre em servidores Discord, por comandos de aplicação e prefixos `k!`/`K!`. Ações administrativas dependem de permissões, hierarquia de cargos e políticas de acesso aplicáveis. Ferramentas da equipe possuem acesso restrito.

O projeto também é apresentado no portfólio de desenvolvimento de software de Athos Montarroyos. O código é proprietário, conforme [LICENSE.md](LICENSE.md).

## Capabilities and Constraints

- O bot e a persistência estão implementados. O [estado atual](docs/project/current-state.md) e o [README](README.md) descrevem as capacidades existentes; não tratar esse catálogo como roadmap aprovado.
- A Home local está implementada conforme o [brief do Figma](.ui/home-figma.md). Publicação, Dashboard e integrações continuam futuras.
- A stack existente está em revisão. Nenhum framework ou fornecedor substituto foi escolhido; revisão não autoriza migração nem revoga os controles atuais.
- Isolamento de ambientes, autorização, proteção de secrets, backup e recuperação continuam requisitos, conforme o [replanejamento](docs/project/replanning.md) e os documentos de domínio aplicáveis.
- Não inventar funcionalidades, estatísticas, disponibilidade, atividade ao vivo, depoimentos ou promessas operacionais para preencher interfaces.

## Brand Commitments

KuruttinaBot permanece como nome provisório. A identidade é própria; a antiga associação a uma personagem foi descartada e não deve voltar como inspiração ou alternativa.

Voz feminina, cortesia, elegância, confiança e emojis expressivos são compromissos registrados no [replanejamento](docs/project/replanning.md). As regras detalhadas de comunicação permanecem na [personalidade do bot](docs/project/bot-personality.md) e no [catálogo de emojis](docs/project/emoji-catalog.md); ambos devem ser lidos integralmente antes de criar, alterar ou revisar falas do bot.

A identidade visual geral continua em definição. Uma proposta de Home não estabelece automaticamente um sistema visual para todo o produto. As imagens, paletas e fontes descartadas no replanejamento não devem ser reutilizadas como ponto de partida.

## Evidence on Hand

- [Replanejamento](docs/project/replanning.md): propósito, decisões aprovadas, identidade descartada e escolhas pendentes.
- [Estado implementado](docs/project/current-state.md), [README](README.md) e código em `apps/bot/` e `packages/`: evidências locais da implementação; não comprovam disponibilidade dos serviços remotos.
- [LICENSE.md](LICENSE.md): autoria e termos do projeto.

Não foram fornecidas métricas verificadas de adoção ou disponibilidade para uso como prova pública. A origem da foto atual do bot e a URL real de convite continuam pendentes.

## Product Principles

1. Priorizar necessidades de administradores e moderadores sem reduzir o produto a uma única categoria de comandos.
2. Separar capacidade implementada, proposta e decisão em aberto em toda apresentação do produto.
3. Preservar identidade própria e os compromissos de comunicação registrados.
4. Avaliar escolhas técnicas por custo, simplicidade operacional, confiabilidade e facilidade de migração, mantendo os controles vigentes até uma decisão substituta.
