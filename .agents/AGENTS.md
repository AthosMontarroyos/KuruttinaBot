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
- **Root Environment File (`.env`)**: All shared environment variables (`.env`, `.env.example`, `.env.local`) MUST reside strictly at the project root (`.env`). Both `apps/bot` and `apps/website` load environment settings directly from the root `.env` to prevent duplicating credentials across `apps/`.

## Available Workspace Skills

- **`fullstack-architect`**: Master skill linking `discord-bot-architect`, `frontend-architect`, and `copywriting`. Enforces full-stack DRY principles, shared TypeScript types, folder separation by utility, and persuasive UX copy.
- **`discord-bot-architect`**: Specialized skill for building production-ready Discord bots in TypeScript (Slash commands, intents, rate limiting, sharding).
- **`frontend-architect`**: Specialized skill for building React + TypeScript dashboards, incorporating **Impeccable** for UI polish and **Copywriting** for headlines, CTAs, and onboarding text.
- **`copywriting`**: Specialized skill for persuasive headlines, CTAs, landing page copy, value propositions, and ENTP voice alignment.
- **`commit-architect`**: Specialized skill for executing atomic Conventional Commits with pre-commit security checks (.env shielding) and GitHub synchronization.
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

### 3. Extreme Optimization & AWS Resource Efficiency
- **Mandatory Policy**: Since Kuruttina targets production deployment on **Amazon AWS** (ECS/Fargate/EC2), all code must be **extremely optimized** for low memory overhead, CPU efficiency, and minimal database/network latency.
- **Zero Memory Leaks**: Always clean up message component collectors, unbind event listeners, and set TTL limits on in-memory caches.
- **Database Query Optimization (Supabase)**: Select explicit required columns (`select('id, guild_id')` instead of `select('*')`), use indexed queries, pagination, and connection pooling.
- **In-Memory Caching**: Cache frequent read-heavy server configurations and permissions to minimize external DB roundtrips.
- **Non-blocking Event Loop**: Never execute heavy synchronous operations (`readFileSync`, heavy calculation loops) on the main Node.js event loop.
- **Bundle & Asset Efficiency**: Optimize frontend bundles (tree-shaking, lazy loading) and serve compressed visual assets.

### 4. Dynamic API & Database Fetching (No Hardcoded State)
- **Mandatory Policy**: Never hardcode values or state variables that may change over time (e.g., bot avatar URL, server icon, user nicknames, role IDs, guild settings).
- **Dynamic Fetching**: Always request dynamic data live from APIs (e.g. Discord API `client.user?.displayAvatarURL()`, `guild.iconURL()`) or query Supabase database.
- **Data Resilience**: Guarantee that if a bot avatar, guild setting, or user profile changes, the application reflects it dynamically without requiring code edits or redeployments.

### 5. Discord.js & API Documentation Research
- Always refer to official Discord.js v14 documentation (`discord.js.org` / `discordjs.dev`).
- When encountering unfamiliar Discord API features, deprecations, or version changes, perform deep research on `discord.js.org`.

### 6. Interaction Guidelines (3-Second Rule)
- All Discord interaction triggers (Slash Commands, Buttons, Select Menus, Modals) **must be acknowledged within 3 seconds**.
- For async operations exceeding 3 seconds (DB queries with Supabase, external API calls, LLM processing), call `interaction.deferReply()` or `interaction.deferUpdate()` immediately.

### 7. Absolute Zero-Leak Security & Environment Protection Policy
- **MANDATORY POLICY (ZERO EXCEPTION)**: Under NO CIRCUMSTANCES should any Discord Bot Token, Supabase API key, Database Connection String (`DATABASE_URL`), secret key, or credential string EVER be hardcoded directly into source code, sample scripts, commit messages, or public documentation files.
- **Root `.env` Strict Containment**: Secrets live exclusively in the untracked `.env` file at the root of the project.
- **Git Shield**: Always verify `.gitignore` contains `.env`, `.env.local`, `.env.*.local` before staging or committing any files.
- **`.env.example` Template**: Public templates (`.env.example`) must contain placeholder text only (`your_token_here`).
- **Console & Error Log Sanitization**: Never log sensitive credential values or environment strings to stdout, stderr, or external crash reports.
- **Gateway Intents**: Minimize privileged intents (avoid `MessageContent` or `GuildMembers` unless strictly required).

### 8. Strict User & Guild Data Privacy & Protection Policy (100% Care)
- **100% Data Care Policy**: All user personal data (user IDs, avatars, preferences) and guild server data (server IDs, roles, moderation logs, settings) must be handled with total privacy, confidentiality, and security.
- **Data Minimization**: Collect and store only the minimal data strictly required for bot operations and dashboard features. Never store private DMs, message content outside command scope, or sensitive user information.
- **Database Access Security (Supabase RLS)**: Enforce Supabase Row Level Security (RLS) policies so guild data can only be accessed or modified by authorized server administrators/moderators.
- **Sanitization & Anonymization**: Never expose raw user IDs or internal guild data in public telemetry, error messages, or logs.
- **Data Removal (LGPD/GDPR)**: Ensure bot architecture supports data deletion/anonymization if a server removes Kuruttina or a user requests data erasure.

### 9. Never Trust the Frontend (Server-Side Validation & Authorization)
- **MANDATORY SECURITY PRINCIPLE**: Never rely on client-side / frontend validation, checks, or state. The frontend is considered an untrusted environment.
- **Server-Side Authorization**: Every API route, WebSocket connection, or backend action must re-verify user identity (Discord OAuth2 session), permissions (Administrator/Manage Guild permissions), and guild ownership on the server before modifying database or bot state.
- **Server-Side Validation**: Validate all incoming payload schemas (using type-safe schema validators like Zod) and sanitize inputs on the server to prevent injection attacks, parameter tampering, or unauthorized privilege escalation.
- **Client Checks Are UX Only**: Client-side form checks or hidden buttons are for user experience only, never for security enforcement.

### 10. Code Architecture & Style

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

#### Frontend (Next.js / React + Impeccable + Copywriting)
- Build modular, clean React components using modern React patterns (Functional Components, Hooks, Custom Hooks).
- Serve shared assets from `Pictures/` via Next.js API asset routers.
- Use `frontend-architect`, `impeccable`, and `copywriting` rules for UI design, persuasive UX copy, responsiveness, accessibility (a11y), visual polish, and ENTP voice consistency.
