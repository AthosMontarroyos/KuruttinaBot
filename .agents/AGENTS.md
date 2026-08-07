# AGENTS.md - Kuruttina Guidelines

Guidelines and rules for AI coding assistants working in this repository.

## Naming & Personality Guidelines
- **Bot Name**: Always refer to the bot strictly as **Kuruttina** (never "KuruttinaBot" or other variations in responses, UI text, or documentation).
- **Personality (ENTP)**: Kuruttina has an **ENTP** personality ("The Debater / Visionary Innovator").
  - **Traits**: Quick-witted, witty, playfully sarcastic, highly analytical, energetic, creative, direct, and sharp-humored.
  - **Application**: All bot responses, system messages, embed footers, LLM prompts/personas, command descriptions, and UI copy should reflect Kuruttina's clever, confident, and witty ENTP tone.

## Tech Stack & Infrastructure

`Kuruttina` is a full-stack Discord bot application utilizing:
- **Language**: TypeScript (`.ts`, `.tsx`)
- **Bot Engine**: Discord.js v14 (`TypeScript`)
- **Database (Active)**: **Supabase** (Cloud PostgreSQL database + `@supabase/supabase-js` for server configs, moderation logs, user states).
- **Database (In Development)**: **Kurubase** (Personal self-hosted Supabase database instance).
- **Frontend / Dashboard**: Next.js / React (TypeScript) with **Impeccable** integration for UI craft and auditing.
- **Hosting (Development)**: **Vercel** (Frontend) or **Railway** (Bot / Backend staging).
- **Hosting (Production Final)**: **Amazon AWS** (AWS ECS/EC2/Fargate/S3).
- **Domain & Tunnel Routing**: **Cloudflare Tunnel** routing traffic to `kuruttinabot.athosmontarroyos.com`.

## Shared Files & Image Assets Architecture

- **Root Image Storage (`Pictures/`)**: All image files and visual assets must be stored strictly in `Pictures/` at the project root, organized into utility subfolders:
  - `Pictures/branding/` (Logos, banners, brand assets)
  - `Pictures/dashboard/` (UI screenshots, dashboard media)
  - `Pictures/avatars/` (Bot & role avatars)
  - `Pictures/icons/` (Category & button icons)
- **External Asset Access in Apps**: No images should be duplicated inside `apps/`. Web apps (`apps/website`) must access external assets outside `apps/` via API router handlers (e.g. Next.js image/asset router endpoints) or symbolic asset routes.

## Available Workspace Skills

- **`fullstack-architect`**: Master skill linking `discord-bot-architect` and `frontend-architect`. Enforces full-stack DRY principles, shared TypeScript types, and folder separation by utility.
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
- For async operations exceeding 3 seconds (DB queries with Supabase, external API calls, LLM processing), call `interaction.deferReply()` or `interaction.deferUpdate()` immediately.

### 5. Intent & Security Best Practices
- Never hardcode Discord Bot Tokens, Supabase Connection Keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), or sensitive credentials in source code.
- Always load credentials from environment variables.
- Ensure `.env` is listed in `.gitignore`.
- Minimize privileged intents (avoid `MessageContent` or `GuildMembers` unless strictly required).

### 6. Code Architecture & Style

#### TypeScript & Type Safety
- Enforce strict typing for slash command options, Supabase database schemas, and API responses. Avoid using `any` wherever possible.
- Define interfaces and types for database models and bot event payloads.

#### Bot Modular Architecture
- **Slash Commands**: Prefer Slash Commands over message content parsing.
- **Commands & Events Structure**: Organize command handlers in `src/commands/` and event handlers in `src/events/` by category/sub-category.
- **Command Deployment**: Keep command registration in a separate deployment script (`src/deploy-commands.ts`). Do not sync commands automatically on every bot startup.
- **Error Handling**: Wrap interaction execution in `try / catch` blocks to gracefully handle errors and notify users.

#### Database (Supabase / PostgreSQL)
- Use `@supabase/supabase-js` or type-safe query builders with auto-generated Supabase TypeScript definitions.
- Ensure database connections and queries are optimized for async execution in bot command handlers.

#### Frontend (Next.js / React + Impeccable)
- Build modular, clean React components using modern React patterns (Functional Components, Hooks, Custom Hooks).
- Serve shared assets from `Pictures/` via Next.js API asset routers.
- Use `frontend-architect` and `impeccable` rules for UI design, responsiveness, accessibility (a11y), and visual polish.
