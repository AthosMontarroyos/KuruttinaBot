# AGENTS.md - Kuruttina Guidelines

Guidelines and rules for AI coding assistants working in this repository.

## Naming & Personality Guidelines
- **Bot Name**: Always refer to the bot strictly as **Kuruttina** (never "KuruttinaBot" or other variations in responses, UI text, or documentation).
- **Personality (INFJ)**: Kuruttina has an **INFJ** personality ("The Advocate / Insightful Protector / Visionary Guardian").
  - **Traits**: Empathetic, insightful, principled, protective, highly analytical, harmonious, direct yet caring, and wisely witty.
  - **Application**: All bot responses, system messages, embed footers, LLM prompts/personas, command descriptions, and UI copy should reflect Kuruttina's thoughtful, protective, and sagaciously witty INFJ tone.
  - **Subtle Persona Enforcement (No Explicit MBTI/Persona Branding)**: The INFJ personality is strictly an internal guide for tone and messaging. NEVER explicitly write MBTI acronyms ("INFJ", "ENTP", "MBTI"), persona badges, or internal style names in user-facing embeds, footers, command responses, or UI text. Keep all user-facing text clean, natural, and professional.

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

### 9. Never Trust the Frontend & Zero-Eval Command Security Policy
- **MANDATORY SECURITY PRINCIPLE**: Never rely on client-side / frontend validation, checks, or state. All inputs and custom command definitions are considered untrusted.
- **Pillar 1: Absolute Zero-Eval Policy (No Dynamic Code Execution)**: NEVER use `eval()`, `new Function()`, or dynamic script execution for custom/affiliate commands. All custom/affiliate commands stored in Supabase MUST be **Declarative Data Structures (JSON templates)** rendered by a fixed, type-safe execution engine (`customCommandPayloadSchema`).
- **Pillar 2: Server-Side Schema Validation & Input Sanitization (Zod)**: Validate all command options, text payloads, and inputs using strict Zod schemas and `sanitizeText()` (`@kuruttina/shared`) to strip control characters, dangerous tags, and malicious script tokens.
- **Pillar 3: Database Parameterized Queries (Supabase SDK Only)**: NEVER concatenate raw SQL strings. Always use parameterized `@supabase/supabase-js` SDK queries to guarantee 100% SQL injection immunity.
- **Pillar 4: Server-Side Authorization Enforcement**: Every API route, command execution, or bot action must re-verify user identity (Discord OAuth2 / User ID) and server permissions (Dev Guild / Manage Guild) on the server before executing. Client checks are UX only, never security.
- **Pillar 5: Discord API Resource Mutation Scope Protection**: Any command or endpoint that performs mutations on Discord API resources (e.g. creating/modifying Application Emojis, guild roles, webhooks, or channels) MUST be strictly gatekept by hardcoded identity checks (`CREATOR_ACCOUNT_ID` / `DEV_ACCOUNT_ID` or verified Guild Administrator permissions). Custom/affiliate commands are strictly DECLARATIVE and CANNOT trigger arbitrary Discord REST API calls or external HTTP fetches.

### 10. Supabase Security & RLS Hardening Policy (Zero AI Fragility)
- **Mandatory Row Level Security (RLS)**: EVERY Supabase table MUST have Row Level Security enabled (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`). NEVER leave tables unshielded.
- **Strict Anti-Wildcard Policies**: NEVER create permissive policies like `FOR ALL USING (true)`. Scopes MUST explicitly verify `auth.uid()` or checked server permissions.
- **Service Role Key Shield**: `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` must ONLY exist in Node.js server environments or Next.js server actions. NEVER expose them to the browser or `NEXT_PUBLIC_` variables.
- **Type-Safe SDK Queries**: Use parameterized `@supabase/supabase-js` SDK queries with auto-generated TypeScript schema types. Avoid raw SQL string concatenation.
- **Zero Destructive Drops**: AI assistants must NEVER execute `DROP TABLE`, `TRUNCATE`, or destructive migrations. All DB changes must be non-destructive, version-controlled migrations.

### 11. Code Architecture & Style

#### TypeScript & Type Safety
- Enforce strict typing for slash command options, Supabase database schemas, and API responses. Avoid using `any` wherever possible.
- Define interfaces and types for database models and bot event payloads.

#### Bot Modular Architecture
- **Dual Slash & Prefix Commands**: Slash Commands (`/command`) are the default primary interface. Every Slash Command **MUST ALSO have an equivalent Prefix Command counterpart** (e.g. `k!command` or custom guild prefix). Core execution logic must be shared via a unified `CommandContext` (DRY principle).
- **Commands & Events Structure**: Organize command handlers in `src/commands/` and event handlers in `src/events/` by category/sub-category.
- **Command Deployment**: Keep command registration in a separate deployment script (`src/deploy-commands.ts`). Do not sync commands automatically on every bot startup.
- **Error Handling**: Wrap interaction execution in `try / catch` blocks to gracefully handle errors and notify users.

#### Database (Supabase / PostgreSQL)
- Use `@supabase/supabase-js` or type-safe query builders with auto-generated Supabase TypeScript definitions.
- Ensure database connections and queries are optimized for async execution in bot command handlers.

#### Frontend (Next.js / React + Impeccable + Copywriting)
- Build modular, clean React components using modern React patterns (Functional Components, Hooks, Custom Hooks).
- Serve shared assets from `Pictures/` via Next.js API asset routers.
- Use `frontend-architect`, `impeccable`, and `copywriting` rules for UI design, persuasive UX copy, responsiveness, accessibility (a11y), visual polish, and INFJ voice consistency.

### 12. JavaScript Object (JSON Format) for Embeds & Components V2
- **MANDATORY POLICY**: All Discord Embeds and Message Components V2 must be defined and constructed in **JavaScript Object Notation (JS Object / JSON format)** (e.g. `APIEmbed`, `APIActionRowComponent`, `APIButtonComponent`, or JSON object factory functions like `{ title, description, color, fields, components }`).
- **Rationale & Exportability**: Raw JS Objects/JSON structures are lightweight, 100% serializable to Supabase DB, easily exportable, and seamlessly shared between the Bot backend (`apps/bot`) and Website frontend (`apps/website` dashboard previews) without tight coupling to Discord.js class instances (`EmbedBuilder` / `ActionRowBuilder`).

### 13. Code Language & Multilingual Localization (i18n) Policy
- **Primary Code Base Language**: **English (`en-US`)** is the mandatory codebase language for variable names, function names, types, inline code comments, git commit messages, and internal architecture documentation.
- **Bot & Dashboard Multilingual Support**: Kuruttina is built multi-lingual from day one, launching with default initial locale support for **`pt-BR`** (Portuguese - Brazil) and **`en-US`** (English).
- **Strict Localization & Translation Rules**:
  - **Command Triggers Immunity (Only Outputs Translated)**: Slash Command names (`/ping`, `/ban`, `/config`) and Prefix Command triggers (`k!ping`, `k!ban`) MUST NEVER be translated. Command names remain 100% standardized globally. ONLY command outputs, embeds, interactive component labels, error messages, and UI text are localized into target languages (`pt-BR`, `en-US`).
  - **Zero Literal Translations**: NEVER translate technical terms, idioms, or expressions word-for-word.
  - **Slang & Cultural Adaptation**: Slang and idiomatic expressions MUST be culturally adapted to fit the target language's natural flow (e.g. `pt-BR`: "Tá ligado?" ➔ `en-US`: "Are you with me?").
  - **Proper Names Preservation**: Proper names, brand names, and bot identity (`Kuruttina`) MUST NEVER be translated unless phonetically or orthographically impossible to comprehend in the target language.

### 14. Development Environment & Zero-Build Policy
- **MANDATORY POLICY**: Production builds (`npm run build` / `tsc` disk emission) are strictly **unnecessary and prohibited** during active development.
- **Development Execution (`npm run dev`)**: All development testing and execution MUST run exclusively using `npm run dev` (`ts-node` in-memory execution for `@kuruttina/bot` and Vite/Next dev server for `@kuruttina/website`).
- **Zero Compiled JS Files in `src/`**: Using `npm run dev` guarantees that no compiled `.js` files pollute `src/` source directories. Only build production bundles if explicitly requested by the user or when validating a final deployment build.

### 15. Mandatory Command Usage Guide Metadata & Help Delegation Policy
- **MANDATORY POLICY**: Every command module created MUST define a structured `guide` property (`CommandUsageGuide` containing `syntax`, `examples`, `detailedDescription`, `requiredPermissions`).
- **Help Delegation Architecture (DRY Principle)**: Individual commands MUST NOT render custom help menus or giant instruction blocks when executed. Instead, command usage metadata is consumed centrally by the `/help` (or `k!help`) command and rendered automatically on the official Website Command Directory (`apps/website`).
- **Interactive Help Guidance**: If a user runs a command with invalid parameters or requests help, the system points them directly to `/help <command>` or to the web command directory link (`https://kuruttinabot.athosmontarroyos.com/commands`).

### 16. Message Writing Philosophy, Emojis & Visual Highlights Policy
- **Engaging & Dynamic Message Formatting (No Plain Text)**: All bot messages, embeds, and responses MUST be visually polished, structured, and highly readable. Avoid plain or unformatted text blocks. Use rich Markdown elements (bold text, inline code blocks `` `value` ``, blockquotes, and lists) to create clean visual hierarchy.
- **Discord Developer Portal Emojis Integration (`EMOJIS`)**: Centralize all emojis in `@kuruttina/shared` (`EMOJIS` constant). Use clean icons/emojis in field titles, headers, and status messages to enhance visual appeal. Supports seamless swapping to custom Discord Application Emojis (`<:name:id>`).
- **Standardized Status Colors & Highlights**: Always use predefined `STATUS_COLORS` (`SUCCESS`, `WARNING`, `ERROR`, `INFO`, `NEUTRAL`) for embed borders, status indicators, and badges to ensure visual consistency across the Bot and Web Dashboard.

### 17. Multi-Scope Deployment & AWS Resource Efficiency for Affiliate/Custom Commands
- **Multi-Scope Deployment Scopes**:
  - `dev` (`npm run deploy:dev`): Deploys strictly `developer` category commands to `DEV_GUILD_ID`.
  - `public` (`npm run deploy:public`): Deploys public commands (`utility`, `moderation`, `admin`) globally or to the dev guild for testing.
  - `affiliate` (`npm run deploy:affiliate`): Syncs commands specifically for affiliate servers stored in Supabase.
  - `all` (`npm run deploy`): Performs full sync across scopes.
- **AWS Infrastructure Resource Efficiency (Zero Polling / Zero Gateway Abuse)**:
  - Custom guild / affiliate commands stored in Supabase MUST NOT use continuous polling loops on AWS Fargate (prevents CPU spikes, memory churn, and Discord REST API rate-limiting).
  - Affiliate/Custom commands are registered **On-Demand** via targeted REST calls (`client.application.commands.set(commands, guildId)`) triggered by Supabase Webhooks or direct guild events (`guildCreate`), caching registered command hashes to skip redundant API roundtrips.
