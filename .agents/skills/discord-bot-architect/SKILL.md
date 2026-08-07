---
name: discord-bot-architect
description: Specialized skill for building production-ready Discord bots. Covers Discord.js (TypeScript/JavaScript) and Pycord (Python), gateway intents, slash commands, interactive components, rate limiting, PostgreSQL integration, React dashboards, and sharding.
risk: unknown
source: vibeship-spawner-skills (Apache 2.0)
date_added: 2026-02-27
---

# Discord Bot Architect

Specialized skill for building production-ready Discord bots and web dashboards.
Covers Discord.js with TypeScript, PostgreSQL database integrations, React web interfaces, gateway intents, slash commands, interactive components, rate limiting, and sharding.

## Principles

- **TypeScript First**: Enforce type safety across command handlers, event listeners, and API contracts.
- Slash commands over message parsing (Message Content Intent deprecated)
- Acknowledge interactions within 3 seconds, always
- Request only required intents (minimize privileged intents)
- **PostgreSQL Persistence**: Store bot settings, user profiles, and logs securely with parameterized queries / ORM.
- **React Dashboard**: Build modern web dashboards for bot management using React with TypeScript.
- Handle rate limits gracefully with exponential backoff
- Plan for sharding from the start (required at 2500+ guilds)
- Use components (buttons, selects, modals) for rich UX
- Test with guild commands first, deploy global when ready
- **Deep Research & Documentation**: Whenever encountering unfamiliar Discord.js features, methods, or version-specific details, perform web searches against official Discord.js documentation (`discord.js.org` / `discordjs.dev`).

## Patterns & Architecture

For detailed code implementations and project templates, refer to [references/patterns.md](references/patterns.md).

### Core Concepts

1. **Discord.js v14 Foundation (TypeScript)**: Modular structure using `Client`, `Collection`, typed slash commands (`SlashCommandBuilder`), and typed event handlers.
2. **PostgreSQL Database Integration**: Type-safe query models for user profiles, guild configurations, and bot analytics.
3. **React Web Dashboard**: Modern React components (Hooks, Tailwind/CSS) for bot administration and user settings.
4. **Interactive Components**: Buttons (`ButtonBuilder`), Select Menus (`StringSelectMenuBuilder`), and Modals (`ModalBuilder`).
5. **Deferred Responses**: Call `interaction.deferReply()` within 3 seconds for database queries or external API calls.
6. **Embed Builders**: Use `EmbedBuilder` with strict limits (max 10 embeds, 6000 total characters).
7. **Rate Limiting & Sharding**: Handle global 50 req/s, gateway limits, and scaling with `ShardingManager`.

## Component Limits

- 5 ActionRows per message/modal
- 5 buttons per ActionRow
- 1 select menu per ActionRow (takes all 5 slots)
- 25 options per select menu
- Modal must be first response (cannot defer prior to `showModal`)

## Sharp Edges

### Interaction Timeout (3 Second Rule)
- **Severity**: CRITICAL
- **Why it breaks**: Discord requires interaction acknowledgement within 3 seconds.
- **Fix**: Call `deferReply()` or `deferUpdate()` immediately before DB or async operations.

### Missing Privileged Intent Configuration
- **Severity**: CRITICAL
- **Why it breaks**: `GUILD_MEMBERS`, `GUILD_PRESENCES`, `MESSAGE_CONTENT` require explicit enablement in Discord Developer Portal AND in code.
- **Fix**: Enable in Developer Portal first, then request only necessary intents in code.

### Command Registration Rate Limited
- **Severity**: HIGH
- **Why it breaks**: Registering commands on every startup hits rate limits.
- **Fix**: Use a dedicated `deploy-commands.ts` script. Use Guild commands for dev testing; Global commands for prod.

### Bot Token & DB Credentials Exposed
- **Severity**: CRITICAL
- **Why it breaks**: Exposed tokens and connection strings allow full compromise.
- **Fix**: Store credentials strictly in `.env`. Ensure `.env` is in `.gitignore`.

### Modal Must Be First Response
- **Severity**: MEDIUM
- **Why it breaks**: Modals cannot be shown after calling `deferReply()` or `reply()`.
- **Fix**: Invoke `interaction.showModal(modal)` as the immediate first response.

## Validation Checks

- **Hardcoded Token or DB Credentials**: ERROR - Credentials must never be hardcoded.
- **Untyped any Usage**: WARNING - Use proper TypeScript types/interfaces.
- **Slow DB Operation Without Defer**: WARNING - DB operations >3s must use deferral.
- **Interaction Without Error Handling**: WARNING - Wrap handlers in try/catch.
- **Syncing Commands on Ready Event**: WARNING - Use a separate deployment script.

## Collaboration & Delegation Triggers

- AI-powered bot features -> `llm-architect`
- Bot database / PostgreSQL queries -> `postgres-wizard`
- Scaled hosting & sharding -> `devops`
- Subscription payments -> `stripe-specialist`

## When to Use

Use this skill when building, refactoring, or optimizing Discord bots & dashboards using TypeScript, Discord.js, PostgreSQL, and React.

## Limitations

- Do not treat output as a substitute for environment-specific validation or deployment testing.
- For unknown or updated Discord.js APIs, always perform deep research on `discord.js.org`.
