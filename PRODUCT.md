# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Turborepo monorepo com Next.js / React (TypeScript) em `apps/website` e Discord.js v14 (TypeScript) em `apps/bot`. Banco de dados Supabase (PostgreSQL ativo) e Kurubase (em desenvolvimento). Hospedagem de desenvolvimento na Vercel/Railway e produção final na Amazon AWS, roteada por Cloudflare Tunnel (`kuruttinabot.athosmontarroyos.com`).

## Users

Administradores e Moderadores de servidores do Discord que gerenciam a Kuruttina, ajustam parâmetros de comunidades e supervisionam a moderação dos canais.

## Product Purpose

Prover um dashboard web moderno, responsivo e intuitivo para o gerenciamento da Kuruttina no Discord, permitindo controlar configurações de servidores, visualizar estatísticas de telemetria ao vivo, auditar ações de moderação e gerenciar permissões com baixa latência.

## Positioning

Uma aplicação full-stack para Discord focada em extrema eficiência de recursos (AWS Ready), combinando a personalidade INFJ da Kuruttina com um painel de gerenciamento elegante, dinâmico e sem duplicação de código.

## Operating Context

Acessado via navegadores web em desktop e dispositivos móveis, integrado ao ecossistema do Discord via autenticação OAuth2 e banco de dados Supabase para sincronização em tempo real.

## Capabilities and Constraints

- **Capacidades**: Configurações de servidores por guild (mensagens de boas-vindas, cargos automáticos, logs de moderação), controle de acesso por comando e monitoramento de telemetria ao vivo (servidores, latência, uptime).
- **Restrições**: Princípio DRY rigoroso, zero valores/URLs hardcoded, arquivo `.env` mantido estritamente na raiz do repositório, assets visuais armazenados na raiz (`Pictures/`), código otimizado para deploy na Amazon AWS.

## Brand Commitments

- **Nome**: Kuruttina (estritamente).
- **Personalidade**: INFJ ("The Advocate / Insightful Protector / Visionary Guardian") — empática, acolhedora, analítica, perspicaz, protetora e sagazmente espirituosa.
- **Assets de Marca**: Armazenados exclusivamente em `Pictures/branding/`, `Pictures/dashboard/`, `Pictures/avatars/`, `Pictures/icons/` e `Pictures/emojis/KuruttinaBotEmojis/`.

## Evidence on Hand

- Diretrizes completas de arquitetura registradas em `AGENTS.md`.
- Monorepo Turborepo com pastas `apps/bot` e `apps/website`.
- Licença proprietária bilingue para exibição em portfólio em `LICENSE`.

## Product Principles

1. **DRY & Reutilização Absoluta**: Componentes, tipos TypeScript e arquivos compartilhados (como `.env` na raiz) centralizados e sem duplicação.
2. **Extrema Otimização de Recursos (AWS Ready)**: Consultas SQL seletivas no Supabase, zero vazamentos de memória e alta eficiência.
3. **Resiliência e Busca Dinâmica**: Dados sempre buscados dinamicamente via APIs (Discord API e Supabase).
4. **Qualidade de UI Impecável**: Interface limpa no modo *Operate*, focada em escaneabilidade, acessibilidade e elegância em dark mode.
