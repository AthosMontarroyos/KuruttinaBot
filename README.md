# Kuruttina — Full-Stack Discord Bot Ecosystem & Web Dashboard

> **Kuruttina** é um ecossistema full-stack moderno, resiliente e altamente otimizado para Discord, combinando um bot de alta performance em **TypeScript (Discord.js v14)** com uma fundação de painel web em **React / Vite** e persistência planejada no **Supabase (PostgreSQL)**.

---

## 📌 Sobre o Projeto

Kuruttina é projetada com arquitetura monorepo (**Turborepo**), focada em extrema eficiência de recursos (AWS Ready), com dados buscados dinamicamente via APIs sem duplicação de código (**DRY**).

- **Nome Oficial**: Kuruttina
- **Personalidade**: **INFJ** ("The Advocate / Insightful Protector / Visionary Guardian") — Empática, protetora, intuitiva, ética e perspicaz.
- **Domínio Oficial**: [`kuruttinabot.athosmontarroyos.com`](https://kuruttinabot.athosmontarroyos.com) (roteado via Cloudflare Tunnel).

---

## 🛠️ Stack Tecnológica & Infraestrutura

- **Linguagem**: TypeScript (`.ts`, `.tsx`) com tipagem estrita
- **Bot Engine**: Discord.js v14 (Node.js)
- **Dashboard Web**: React / Vite (TypeScript) + Impeccable UI Craft — fundação criada; interface ainda não iniciada
- **Banco de Dados (Ativo)**: **Supabase** (PostgreSQL na nuvem + `@supabase/supabase-js`)
- **Banco de Dados (Em Andamento)**: **Kurubase** (Instância própria do Supabase)
- **Monorepo**: Turborepo com npm workspaces (`apps/bot` e `apps/website`)
- **Hospedagem (Dev)**: Vercel (Frontend) & Railway (Bot Staging)
- **Hospedagem (Prod Final)**: Amazon AWS (ECS/Fargate/EC2/S3)
- **Roteamento**: Cloudflare Tunnel

---

## 🏗️ Estrutura do Monorepo

```
KuruttinaBot/
├── apps/
│   ├── bot/                       # Aplicação do Bot Kuruttina (Discord.js v14 + TS)
│   │   ├── src/commands/          # Comandos Slash (aninhados por Categoria/Subcategoria)
│   │   └── src/events/            # Manipuladores de Eventos (aninhados)
│   └── website/                   # Fundação do Dashboard Web (React/Vite + TS)
├── Pictures/                      # Repositório Central de Assets Visuais (Raiz)
│   ├── branding/                  # Logos, banners e marcas
│   ├── dashboard/                 # Capturas e mídias da UI
│   ├── avatars/                   # Avatares do bot e cargos
│   ├── icons/                     # Ícones de botões e categorias
│   └── Roleplay/                  # GIFs de ações e subpastas por gênero
├── .env                           # Variáveis de ambiente únicas da raiz (Ignorado no Git)
├── .env.example                   # Template de variáveis de ambiente
├── .gitignore                     # Proteção de credenciais e arquivos temporários
├── LICENSE                        # Termos de licença bilingues (Proprietária / Portfólio)
├── PRODUCT.md                     # Artefato de contexto de produto (Impeccable)
├── package.json                   # Raiz do Monorepo com npm workspaces
└── turbo.json                     # Pipeline de build e desenvolvimento do Turborepo
```

---

## ⚡ Princípios Globais de Código

1. **DRY (Don't Repeat Yourself)**: Zero duplicação de tipos, utilitários ou componentes.
2. **Busca Dinâmica via APIs**: Nenhuma foto, nome ou configuração fica hardcoded no código; tudo é consultado ao vivo via Discord API e Supabase.
3. **Extrema Otimização (AWS Ready)**: Consultas SQL seletivas, zero vazamento de memória, carregamento lazy e manipulação assíncrona.
4. **Commits Proativos**: Histórico de commits atômicos utilizando convenção tradicional (`feat:`, `fix:`, `docs:`, `refactor:`).

---

## 📜 Licença e Direitos Autorais

Copyright (c) 2026 Athos Montarroyos. Todos os direitos reservados.

Este código-fonte é disponibilizado publicamente **exclusivamente para fins de visualização, auditoria de código e exibição em portfólio**. É estritamente proibida a cópia, clonagem, modificação, redistribuição ou uso comercial/não-comercial por terceiros sem a permissão prévia por escrito. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
