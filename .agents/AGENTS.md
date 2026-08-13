# AGENTS.md - Kuruttina Guidelines

Guidelines and rules for AI coding assistants working in this repository.

## Naming & Personality Guidelines
- **Bot Name**: Always refer to the bot strictly as **Kuruttina** (never "KuruttinaBot" or other variations in responses, UI text, or documentation).
- **Personality (INFJ)**: Kuruttina has an **INFJ** personality ("The Advocate / Insightful Protector / Visionary Guardian").
  - **Traits**: Empathetic, insightful, principled, protective, highly analytical, harmonious, direct yet caring, and wisely witty.
  - **Application**: All bot responses, system messages, embed footers, LLM prompts/personas, command descriptions, and UI copy should reflect Kuruttina's thoughtful, protective, and sagaciously witty INFJ tone.
  - **Subtle Persona Enforcement (No Explicit MBTI/Persona Branding)**: The INFJ personality is strictly an internal guide for tone and messaging. NEVER explicitly write MBTI acronyms ("INFJ", "ENTP", "MBTI"), persona badges, or internal style names in user-facing embeds, footers, command responses, or UI text. Keep all user-facing text clean, natural, and professional.
  - **Fun & Casual Witty Tone (Loritta-style, No Forced/Cheesy Phrases)**: Keep user interactions fun, witty, and naturally engaging (Loritta-style), but WITHOUT forcing cheesy, melodramatic, or overly dramatic quotes. Use natural casual slang and light jokes depending on the target language (pt-BR: "tá mec", "tá ligado?", "de boa", "suave", "btw", "massa", "ok", "sea" | en-US: "btw", "all good", "sea", "ok"). Keep comments light, funny, natural, and grounded.

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
  - `Pictures/emojis/KuruttinaBotEmojis/` (Synced Discord Developer Portal Application Emojis & `catalog.json`)
- **Developer Portal Emojis Sync CLI (`npm run sync:emojis`) & Multi-App Vault Architecture**:
  - **Multi-App Storage System**: Supports scaling emojis beyond Discord's 2,000 total Application Emojis per-app quota by configuring auxiliary Developer Portal apps in `EMOJI_BOT_TOKENS` (comma-separated tokens in `.env`). Auxiliary apps act strictly as REST emoji vaults without gateway connections or AWS memory overhead.
  - **Clean Sync Logic**: Run `npm run sync:emojis` (or `npx ts-node src/scripts/sync-app-emojis.ts` inside `apps/bot/`) to iterate over primary (`DISCORD_TOKEN`) and auxiliary apps (`EMOJI_BOT_TOKENS`), downloading missing emojis into `Pictures/emojis/KuruttinaBotEmojis/`, pruning discarded ones, and generating metadata in `Pictures/emojis/KuruttinaBotEmojis/catalog.json`.
  - **Backend AI Vision & Tagging**: Bot reads `Pictures/emojis/KuruttinaBotEmojis/catalog.json` or inspects local images to analyze visual content and assign tags/reactions dynamically.
  - **Frontend Asset Routing**: Web app (`apps/website`) accesses synced emojis via `/assets/emojis/<filename>` (served directly from `Pictures/emojis/KuruttinaBotEmojis/` via Vite middleware). No image assets duplicated inside `apps/`.
- **Root Environment File (`.env`)**: All shared environment variables (`.env`, `.env.example`, `.env.local`) MUST reside strictly at the project root (`.env`). Both `apps/bot` and `apps/website` load environment settings directly from the root `.env` to prevent duplicating credentials across `apps/`.

## Global Security Overlay & Skill Integration

> 🛡️ **GLOBAL MANDATORY SECURITY BARRIER**:
> The policies defined in [security-architect SKILL.md](skills/security-architect/SKILL.md) apply **automatically and unconditionally across ALL skills** (`discord-bot-architect`, `frontend-architect`, `fullstack-architect`, `commit-architect`, `impeccable`, `copywriting`, `agent-browser`). Whenever any AI assistant or developer executes ANY skill or task, zero-leak credential shielding, Supabase RLS, zero-eval custom commands, server-side Zod validation, and Anti-IDOR identity proofing MUST be enforced.

## Available Workspace Skills & Cross-Referencing

- **[`fullstack-architect`](skills/fullstack-architect/SKILL.md)**: Master architecture skill connecting `discord-bot-architect`, `frontend-architect`, `copywriting`, and `security-architect`. Enforces full-stack DRY principles, `@kuruttina/shared` package contracts, and INFJ voice consistency.
- **[`discord-bot-architect`](skills/discord-bot-architect/SKILL.md)**: Production-ready Discord.js v14 bot architecture in TypeScript (Slash + Prefix `k!`, gateway intents, 3s acknowledgment, Developer Portal emojis, JSON embeds V2).
- **[`frontend-architect`](skills/frontend-architect/SKILL.md)**: Modern React + TypeScript dashboards, incorporating **Impeccable** for UI craft and **Copywriting** for INFJ UX messaging.
- **[`security-architect`](skills/security-architect/SKILL.md)**: Sovereign security checklist, zero-leak credential shield, LGPD/GDPR compliance, Supabase RLS, zero-eval declarative commands, and anti-IDOR session verification.
- **[`commit-architect`](skills/commit-architect/SKILL.md)**: Atomic Conventional Commits with pre-commit security checks (Gitleaks + `.env` shielding). NO automatic `git push`.
- **[`copywriting`](skills/copywriting/SKILL.md)**: High-converting marketing copy, CTAs, landing page copy, value propositions, and INFJ voice alignment.
- **[`impeccable`](skills/impeccable/SKILL.md)**: Design framework and visual craft audit tool for React UI components.
- **[`agent-browser`](skills/agent-browser/SKILL.md)**: Fast browser automation CLI for exploratory testing, QA, and website interactions.


## Core Rules & Principles

### 1. Relative Paths Policy (Zero Hardcoded Machine Paths)
- **MANDATORY POLICY (ZERO EXCEPTION)**: ALWAYS use **relative file paths** (e.g. `.agents/skills/...`, `src/utils/`, `skills/security-architect/SKILL.md`) in code imports, documentation, Markdown links, and scripts.
- **Cross-Platform & Team Portability**: Hardcoded machine paths (e.g. `C:\Users\...` or `file:///c:/Users/...`) are STRICTLY PROHIBITED. All links and paths must resolve dynamically relative to the project root or current directory.

### 2. DRY Principle (Don't Repeat Yourself)
- **Mandatory Policy**: Always adhere strictly to the **DRY (Don't Repeat Yourself)** principle (*The Pragmatic Programmer* by Andy Hunt & Dave Thomas).
- **Zero Code Duplication**: Avoid duplicating logic, types, query snippets, UI components, or validation rules across files.
- **Abstraction & Reuse**: Extract reusable logic into helper utilities (`src/utils/`), custom React hooks (`src/hooks/`), shared TypeScript interfaces (`src/types/`), or base service classes.

### 3. Frequent & Proactive Local Git Commits (NO Automatic `git push`)
- **Mandatory Policy**: Always commit changes locally (`git commit`) as soon as a feature, fix, or code refactoring step is completed.
- **NO Automatic `git push`**: NEVER execute `git push` automatically. Keep all commits strictly local (`git commit`). Only push to remote (`git push origin main`) when explicitly requested by the user.
- **Granular Commits**: Do not accumulate massive uncommitted changes. Perform clean, atomic commits after code edits pass basic checks.
- **Conventional Commits**: Format commit messages clearly using conventional conventions (e.g., `feat:`, `fix:`, `refactor:`, `docs:`, `style:`).

### 4. Extreme Optimization & AWS Resource Efficiency
- **Mandatory Policy**: Since Kuruttina targets production deployment on **Amazon AWS** (ECS/Fargate/EC2), all code must be **extremely optimized** for low memory overhead, CPU efficiency, and minimal database/network latency.
- **Zero Memory Leaks**: Always clean up message component collectors, unbind event listeners, and set TTL limits on in-memory caches.
- **Database Query Optimization (Supabase)**: Select explicit required columns (`select('id, guild_id')` instead of `select('*')`), use indexed queries, pagination, and connection pooling.
- **In-Memory Caching**: Cache frequent read-heavy server configurations and permissions to minimize external DB roundtrips.
- **Non-blocking Event Loop**: Never execute heavy synchronous operations (`readFileSync`, heavy calculation loops) on the main Node.js event loop.
- **Bundle & Asset Efficiency**: Optimize frontend bundles (tree-shaking, lazy loading) and serve compressed visual assets.

### 5. Dynamic API & Database Fetching (No Hardcoded State)
- **Mandatory Policy**: Never hardcode values or state variables that may change over time (e.g., bot avatar URL, server icon, user nicknames, role IDs, guild settings).
- **Dynamic Fetching**: Always request dynamic data live from APIs (e.g. Discord API `client.user?.displayAvatarURL()`, `guild.iconURL()`) or query Supabase database.
- **Data Resilience**: Guarantee that if a bot avatar, guild setting, or user profile changes, the application reflects it dynamically without requiring code edits or redeployments.

### 6. Discord.js & API Documentation Research
- Always refer to official Discord.js v14 documentation (`discord.js.org` / `discordjs.dev`).
- When encountering unfamiliar Discord API features, deprecations, or version changes, perform deep research on `discord.js.org`.

### 7. Interaction Guidelines (3-Second Rule)
- All Discord interaction triggers (Slash Commands, Buttons, Select Menus, Modals) **must be acknowledged within 3 seconds**.
- For async operations exceeding 3 seconds (DB queries with Supabase, external API calls, LLM processing), call `interaction.deferReply()` or `interaction.deferUpdate()` immediately.

### 8. Absolute Zero-Leak Security & Environment Protection Policy
- **MANDATORY POLICY (ZERO EXCEPTION)**: Under NO CIRCUMSTANCES should any Discord Bot Token, Supabase API key, Database Connection String (`DATABASE_URL`), secret key, or credential string EVER be hardcoded directly into source code, sample scripts, commit messages, or public documentation files.
- **Secrets & Git Shield**: Secrets live exclusively in root `.env`. Verify `.gitignore` contains `.env`, `.env.local`, `.env.*.local`. Sanitize console/error logs.
- **Mandatory Gitleaks Scanning**: Gitleaks scanner MUST remain active in pre-commit hooks and GitHub Actions workflows (`gitleaks detect --staged`).
- **Complete Security Framework**: For full checklist and security audit protocol, refer to [security-architect SKILL.md](skills/security-architect/SKILL.md).

### 9. User & Guild Data Privacy & Protection Policy (100% Care)
- **100% Data Care Policy**: All user personal data and guild server data must be handled with total privacy, confidentiality, and security. Minimization rule applies.
- **Database Access Security (Supabase RLS)**: Enforce Supabase Row Level Security (RLS) on 100% of tables (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`). No wildcard policies (`FOR ALL USING (true)`).
- **Data Removal (LGPD/GDPR)**: Support data deletion/anonymization upon server bot removal or user request.

### 10. Never Trust Frontend & Zero-Eval Command Security Policy
- 🚨 **ZERO FRONTEND TRUST & ZERO DIRECT DB ON FRONTEND**: Never expose database credentials, DB queries, or `SUPABASE_SERVICE_ROLE_KEY` to browser/frontend code (`apps/website`). ALL database actions MUST run strictly server-side (Node backend / Next.js Server Actions).
- **Zero-Eval Custom Commands**: Custom commands MUST be Declarative Data Structures (JSON templates) validated by Zod (`customCommandPayloadSchema`) — NEVER `eval()` or dynamic code execution.
- **Key Pillars Summary**: SQL Injection Immunity (SDK queries only), Server Authorization (`PermissionGuard`), REST Mutation Scope Protection (`DEV_ACCOUNT_ID` gatekeeping), Ping Spam Immunity (`allowedMentions: { parse: [] }`), In-Memory Rate Limiting (`CooldownManager`), Component Namespacing (`createCustomId`), Anti-IDOR identity proofing.
- **Detailed Security Rules**: See [security-architect SKILL.md](skills/security-architect/SKILL.md).

### 10. Supabase Security & RLS Hardening Policy
- **Mandatory Row Level Security (RLS)**: `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` BEFORE deployment. Zero unshielded tables permitted.
- **Service Role Key Shield**: `SUPABASE_SERVICE_ROLE_KEY` exists ONLY in server environments.
- **Zero Destructive Drops**: Never execute `DROP TABLE`, `TRUNCATE`, or destructive migrations. Use version-controlled migrations.

### 11. Code Architecture & Style

#### TypeScript & Type Safety
- Enforce strict typing for slash command options, Supabase database schemas, and API responses. Avoid using `any` wherever possible.
- Define interfaces and types for database models and bot event payloads.

#### Bot Modular Architecture
- **Dual Slash & Prefix Commands**: Slash Commands (`/command`) are the default primary interface. Every Slash Command **MUST ALSO have an equivalent Prefix Command counterpart** (e.g. `k!command` or custom guild prefix). Core execution logic must be shared via a unified `CommandContext` (DRY principle).
- **Commands, Events, Utils & Scripts Structure**:
  - Command handlers MUST reside in `src/commands/` and event handlers in `src/events/` by category/sub-category.
  - Utility modules MUST reside in domain subfolders (`src/utils/embeds/`, `src/utils/emojis/`, `src/utils/loaders/`, `src/utils/security/`, `src/utils/users/`) and be re-exported via `src/utils/index.ts` (Barrel Export) so callers import cleanly from `utils`.
  - CLI automation scripts MUST reside in domain subfolders (e.g. `src/scripts/emojis/`).
- **Command Deployment**: Keep command registration in a separate deployment script (`src/deploy-commands.ts`). Do not sync commands automatically on every bot startup.
- **Error Handling**: Wrap interaction execution in `try / catch` blocks to gracefully handle errors and notify users.

#### Single Option User Resolution & `resolveUser` Utility Component Policy
- **Single Unified Option `usuario`**: Any command requiring user targeting (e.g. avatar, banner, moderation, profile, clear) MUST define a single Slash Command String Option named `usuario` (e.g. `.addStringOption(opt => opt.setName('usuario').setDescription('Usuário por menção (@usuario) ou ID numérico'))`) rather than separate `usuario` and `id` options.
- **Unified Parsing (`resolveUser`)**: All user resolution MUST be handled via `resolveUser(ctx, input?, options?)` (`src/utils/users/user-resolver.ts`, re-exported via `src/utils/index.ts`).
- **Mentions & Snowflake IDs**: Automatically extracts snowflake IDs from mentions (`<@123...>`, `<@!123...>`), raw numeric IDs (`123456789...`), or User objects across both Slash interactions and Prefix args (`k!cmd @user` / `k!cmd 123...`).
- **Safe Option Resolution**: Uses type-agnostic `options.get()` inside `resolveUser` to safely extract String values or User objects without throwing `DiscordjsTypeError`.

#### Time Duration Parsing & `parseTimeString` Utility Component Policy
- **Unified Time Parsing (`parseTimeString`)**: Any command requiring time duration input (e.g. message deletion window, timeouts, mutes, tempbans, reminders, cooldowns) MUST use `parseTimeString(input, options)` (`src/utils/time/time-parser.ts`, re-exported via `src/utils/index.ts`).
- **Supported Units & Formats**: Supports `s` (seconds), `m` (minutes), `h` (hours), `d` (days) and combined durations (e.g. `28s`, `28m`, `28h`, `7d`, `1d12h`).
- **Default Unit & Numeric Fallback**: Accepts pure numbers (e.g. `7` or `28`), using `options.defaultUnit` (e.g. `defaultUnit: 'd'` defaults raw numbers to days for ban/mute commands).
- **Flexible Argument Order in Prefix Commands**: When parsing prefix commands with optional time and reason (e.g. `k!ban @user 7d Spam` or `k!ban @user Spam 7d`), inspect both the first extra argument (`args[1]`) and the last argument (`args[args.length - 1]`) using `parseTimeString` so users can specify duration before or after the reason naturally.
- **Human-Readable Output**: `parseTimeString` returns `ParsedTimeResult` containing `seconds`, `milliseconds`, `formatted` (e.g. `28d`), and localized `humanReadable` string (e.g. `28 Dias` or `1 Hora e 30 Minutos`).

#### Database (Supabase / PostgreSQL)
- Use `@supabase/supabase-js` or type-safe query builders with auto-generated Supabase TypeScript definitions.
- Ensure database connections and queries are optimized for async execution in bot command handlers.

#### Frontend (Next.js / React + Impeccable + Copywriting)
- Build modular, clean React components using modern React patterns (Functional Components, Hooks, Custom Hooks).
- Serve shared assets from `Pictures/` via Next.js API asset routers.
- Use `frontend-architect`, `impeccable`, and `copywriting` rules for UI design, persuasive UX copy, responsiveness, accessibility (a11y), visual polish, and INFJ voice consistency.
- **AI Image Generation Engine (Gemini / `nanobanana`)**: Whenever generating UI mockups, concept comps, or visual assets with Impeccable/AI, the active AI engine is strictly **Gemini** (using the harness-native `generate_image` / `nanobanana` model). NEVER use OpenAI or GPT Images (`gpt-image-2`).

### 12. JavaScript Object (JSON Format) for Embeds & Components V2
- **MANDATORY POLICY**: All Discord Embeds and Message Components V2 must be defined and constructed in **JavaScript Object Notation (JS Object / JSON format)** (e.g. `APIEmbed`, `APIActionRowComponent`, `APIButtonComponent`, or JSON object factory functions like `{ title, description, color, fields, components }`).
- **Rationale & Exportability**: Raw JS Objects/JSON structures are lightweight, 100% serializable to Supabase DB, easily exportable, and seamlessly shared between the Bot backend (`apps/bot`) and Website frontend (`apps/website` dashboard previews) without tight coupling to Discord.js class instances (`EmbedBuilder` / `ActionRowBuilder`).
- **Quick Action Commands Output Policy (Lightweight Text Feedback)**: Quick action and moderation commands (e.g. `clear`, `kick`, `ban`, `unban`, `timeout`, `untimeout`) MUST NOT return heavy multi-field embeds. They MUST return concise text message responses (`content: ...`) formatted with their corresponding action emojis (`${e.CLEAR}`, `${e.KICK}`, `${e.BAN}`, `${e.UNBAN}`, `${e.TIMEOUT}`, `${e.UNTIMEOUT}`) and Markdown. Informative commands (such as `ping` and `help`) retain their detailed rich embed responses.

### 13. Code Language & Multilingual Localization (i18n) Policy
- **Primary Code Base Language**: **English (`en-US`)** is the mandatory codebase language for variable names, function names, types, inline code comments, git commit messages, and internal architecture documentation.
- **Bot & Dashboard Multilingual Support**: Kuruttina is built multi-lingual from day one, launching with default initial locale support for **`pt-BR`** (Portuguese - Brazil) and **`en-US`** (English).
- **Strict Localization & Translation Rules**:
  - **Command Triggers Immunity (Only Outputs Translated)**: Slash Command names (`/ping`, `/ban`, `/config`) and Prefix Command triggers (`k!ping`, `k!ban`) MUST NEVER be translated. Command names remain 100% standardized globally. ONLY command outputs, embeds, interactive component labels, error messages, and UI text are localized into target languages (`pt-BR`, `en-US`).
  - **Zero Literal Translations**: NEVER translate technical terms, idioms, or expressions word-for-word.
  - **Slang & Cultural Adaptation**: Slang and idiomatic expressions MUST be culturally adapted to fit the target language's natural flow (e.g. `pt-BR`: "Tá ligado?" ➔ `en-US`: "Are you with me?").
  - **Proper Names Preservation**: Proper names, brand names, and bot identity (`Kuruttina`) MUST NEVER be translated unless phonetically or orthographically impossible to comprehend in the target language.

### 14. Development Environment & Zero-Build Policy
- **MANDATORY POLICY**: Production builds (`npm run build` / `tsc` disk emission creating `dist/`) are strictly **unnecessary and prohibited** during active development.
- **Development Execution (`npm run dev`)**: All development testing and execution MUST run exclusively using `npm run dev` (`ts-node` in-memory execution for `@kuruttina/bot` and Vite/Next dev server for `@kuruttina/website`).
- **Zero Compiled JS Files / No `dist/` Directory**: To check TypeScript compilation errors without emitting `dist/` files to disk, ALWAYS use `npx tsc --noEmit`. Only build production bundles if explicitly requested by the user or when validating a final deployment build.

### 15. Mandatory Command Usage Guide Metadata & Help Delegation Policy
- **MANDATORY POLICY**: Every command module created MUST define a structured `guide` property (`CommandUsageGuide` containing `syntax`, `examples`, `detailedDescription`, `requiredPermissions`).
- **Help Delegation Architecture (DRY Principle)**: Individual commands MUST NOT render custom help menus or giant instruction blocks when executed. Instead, command usage metadata is consumed centrally by the `/help` (or `k!help`) command and rendered automatically on the official Website Command Directory (`apps/website`).
- **Interactive Help Guidance**: If a user runs a command with invalid parameters or requests help, the system points them directly to `/help <command>` or to the web command directory link (`https://kuruttinabot.athosmontarroyos.com/commands`).

### 16. Message Writing Philosophy, Emojis & Visual Highlights Policy
- **Engaging & Dynamic Message Formatting (No Plain Text)**: All bot messages, embeds, and responses MUST be visually polished, structured, and highly readable. Avoid plain or unformatted text blocks. Use rich Markdown elements (bold text, inline code blocks `` `value` ``, blockquotes, and lists) to create clean visual hierarchy.
- **Discord Developer Portal Emojis Integration (`const e = await getEmojis(client)`)**:
  - **Dynamic Single-Object Emoji Resolution (`const e = await getEmojis(client)`)**: All bot commands, embeds, and event handlers MUST resolve emojis into a single helper object `e` using `const e = await getEmojis(client)` (`src/utils/emoji-resolver.ts`).
  - **ZERO DESTRUCTURING / EXPORT BOILERPLATE**: NEVER write giant destructuring blocks (`const { DANCING: dancingEmoji, ... } = await getEmojis(...)`) or list 15-30 variables manually. Simply call `const e = await getEmojis(client)` once at the start of execution and access properties on `e` directly across the file (`e.SEARCH`, `e.DANCING`, `e.SUCCESS`, `e.ERROR`, `e.RENDER`, `e.WARNING`, `e.STAR`).
  - **Interactive & Expressive Aesthetic (No Corporate Plain Icons)**: Custom Developer Portal emojis should be expressive, interactive, character-driven, animated GIF/APNG (`<a:name:id>`), or anime/chibi styled reflecting Kuruttina's INFJ personality rather than corporate static icons.
  - **Dynamic Resolution Engine**: When the developer uploads a custom emoji to the Discord Developer Portal with a name matching a system key (e.g. `success`, `error`, `moderation`, `shield`), `getEmojis()` automatically detects it from `client.application.emojis.cache` and renders the custom Developer Portal emoji (`<:name:id>` / `<a:name:id>`) in all bot embeds and UI designs without requiring code changes!
  - **Official Emoji Naming Matrix**:
    - Status: `success`, `error`, `warning`, `info`, `loading`
    - Categories: `moderation`, `utility`, `developer`, `admin`, `fun`, `affiliate`
    - Actions: `ban`, `kick`, `mute`, `unmute`, `clear`, `search`, `add`, `trash`
    - Infrastructure: `ping`, `gateway`, `api`, `bot_status`, `uptime`
    - Security: `shield`, `lock`, `unlock`, `settings`, `logs`, `user`, `guild`, `crown`
    - Branding: `link`, `documentation`, `star`
  - **Application Emoji Scope Optimization**: Developer Portal Application Emojis are reserved strictly for core system tokens (`STATUS`, `CATEGORIES`, `ACTIONS`, `TELEMETRY`, `SECURITY`, `BRANDING`). Custom decoration or third-party emojis can be referenced via formatted strings (`<:name:id>`) without consuming application emoji quota.
- **Manual Image & Asset Authoring Policy (Zero AI Image Generation)**: AI assistants MUST NEVER generate image assets or emojis via AI image tools. All image assets, banners, icons, dividers, and custom emojis are created and uploaded manually by the developer. AI assistants strictly consume, inspect, and synchronize the developer's custom Application Emojis via `npm run sync:emojis` (`npx ts-node src/scripts/sync-app-emojis.ts`).
- **Pre-Inspection Application Emoji Requirement**: BEFORE creating or modifying any bot command or embed involving emojis, AI agents MUST execute `npx ts-node src/scripts/fetch-app-emojis.ts` (inside `apps/bot/`) to inspect all live custom Application Emojis uploaded to the Discord Developer Portal.
- **Strict Black or White Embed Color Theme Policy & `createKuruttinaEmbed` Factory**: All Discord Embeds must use strictly **Black** (`0x000001` / `#000000`) or **White** (`0xFFFFFF` / `#FFFFFF`) color themes for embed side borders. Construct embeds using `createKuruttinaEmbed(client, options)` (`src/utils/embed-builder.ts`) to automatically enforce border styling, dynamic bot avatar URLs, and ISO timestamps. Use `sendErrorReply` and `sendSuccessReply` for standardized command feedback.

### 17. Multi-Scope Deployment & AWS Resource Efficiency for Affiliate/Custom Commands
- **Multi-Scope Deployment Scopes**:
  - `dev` (`npm run deploy:dev`): Deploys strictly `developer` category commands to `DEV_GUILD_ID`.
  - `public` (`npm run deploy:public`): Deploys public commands (`utility`, `moderation`, `admin`) globally or to the dev guild for testing.
  - `affiliate` (`npm run deploy:affiliate`): Syncs commands specifically for affiliate servers stored in Supabase.
  - `all` (`npm run deploy`): Performs full sync across scopes.
- **AWS Infrastructure Resource Efficiency (Zero Polling / Zero Gateway Abuse)**:
  - Custom guild / affiliate commands stored in Supabase MUST NOT use continuous polling loops on AWS Fargate (prevents CPU spikes, memory churn, and Discord REST API rate-limiting).
  - Affiliate/Custom commands are registered **On-Demand** via targeted REST calls (`client.application.commands.set(commands, guildId)`) triggered by Supabase Webhooks or direct guild events (`guildCreate`), caching registered command hashes to skip redundant API roundtrips.

### 18. Mandatory Knowledge Persistence & Skill Documentation Policy
- **MANDATORY POLICY (ZERO EXCEPTION)**: NEVER, under ANY circumstances, fail to document valuable new technical decisions, architectural rules, security policies, workflows, or developer guidelines inside **`AGENTS.md`** or the specific relevant **Skill file** (`.agents/skills/<skill_name>/SKILL.md`).
- **Immediate Context Persistence**: Every new rule, constraint, or pattern established during development MUST be immediately persisted into the appropriate documentation file so future AI sessions and team members inherit the context automatically.
