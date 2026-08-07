# AGENTS.md - Kuruttina Guidelines

Guidelines and rules for AI coding assistants working in this repository.

## Naming Naming Convention
- **Bot Name**: Always refer to the bot strictly as **Kuruttina** (never "KuruttinaBot" or other variations in responses, UI text, or documentation).

## Tech Stack & Ecosystem

`Kuruttina` is a full-stack Discord bot application utilizing:
- **Language**: TypeScript (`.ts`, `.tsx`)
- **Bot Engine**: Discord.js v14 (`TypeScript`)
- **Database**: PostgreSQL (Data persistence, server configs, moderation logs, user states)
- **Frontend / Dashboard**: React (TypeScript) with **Impeccable** integration for UI craft and auditing.

## Available Workspace Skills

- **`discord-bot-architect`**: Specialized skill for building production-ready Discord bots in TypeScript (Slash commands, intents, rate limiting, sharding).
- **`frontend-architect`**: Specialized skill for building React + TypeScript dashboards, incorporating **Impeccable** for UI polish, accessibility, and visual audits.
- **`impeccable`**: Design framework and audit tool for frontend UI craft.

## Core Rules & Principles

### 1. DRY Principle (Don't Repeat Yourself)
- **Mandatory Policy**: Always adhere strictly to the **DRY (Don't Repeat Yourself)** principle (*The Pragmatic Programmer* by Andy Hunt & Dave Thomas).
- **Zero Code Duplication**: Avoid duplicating logic, types, query snippets, UI components, or validation rules across files.
- **Abstraction & Reuse**: Extract reusable logic into helper utilities (`src/utils/`), custom React hooks (`src/hooks/`), shared TypeScript interfaces (`src/types/`), or base service classes.

### 2. Frequent & Proactive Git Commits
- **Mandatory Policy**: Always commit changes as soon as a feature, fix, or code refactoring step is completed.
- **Granular Commits**: Do not accumulate massive uncommitted changes. Perform clean, atomic commits after code edits pass basic checks.
- **Conventional Commits**: Format commit messages clearly using conventional conventions (e.g., `feat:`, `fix:`, `refactor:`, `docs:`, `style:`).

### 3. Discord.js & API Documentation Research
- Always refer to official Discord.js v14 documentation (`discord.js.org` / `discordjs.dev`).
- When encountering unfamiliar Discord API features, deprecations, or version changes, perform deep research on `discord.js.org`.

### 4. Interaction Guidelines (3-Second Rule)
- All Discord interaction triggers (Slash Commands, Buttons, Select Menus, Modals) **must be acknowledged within 3 seconds**.
- For async operations exceeding 3 seconds (DB queries with PostgreSQL, external API calls, LLM processing), call `interaction.deferReply()` or `interaction.deferUpdate()` immediately.

### 5. Intent & Security Best Practices
- Never hardcode Discord Bot Tokens, Database Connection Strings, API keys, or sensitive credentials in source code.
- Always load credentials from environment variables (`process.env.DISCORD_TOKEN`, `process.env.DATABASE_URL`, etc.).
- Ensure `.env` is listed in `.gitignore`.
- Minimize privileged intents (avoid `MessageContent` or `GuildMembers` unless strictly required).

### 6. Code Architecture & Style

#### TypeScript & Type Safety
- Enforce strict typing for slash command options, database models, and API responses. Avoid using `any` wherever possible.
- Define interfaces and types for database models and bot event payloads.

#### Bot Modular Architecture
- **Slash Commands**: Prefer Slash Commands over message content parsing.
- **Commands & Events Structure**: Organize command handlers in `src/commands/` and event handlers in `src/events/`.
- **Command Deployment**: Keep command registration in a separate deployment script (`src/deploy-commands.ts`). Do not sync commands automatically on every bot startup.
- **Error Handling**: Wrap interaction execution in `try / catch` blocks to gracefully handle errors and notify users.

#### Database (PostgreSQL)
- Use parametrized queries or a type-safe ORM / query builder (e.g. Prisma or Drizzle) to prevent SQL injection.
- Ensure database connections and queries are optimized for async execution in bot command handlers.

#### Frontend (React + Impeccable)
- Build modular, clean React components using modern React patterns (Functional Components, Hooks, Custom Hooks).
- Use `frontend-architect` and `impeccable` rules for UI design, responsiveness, accessibility (a11y), and visual polish.
- Ensure strict TypeScript typing for props and component states.
