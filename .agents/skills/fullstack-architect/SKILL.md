---
name: fullstack-architect
description: Master skill linking discord-bot-architect, frontend-architect, and copywriting. Enforces full-stack architecture for Kuruttina, strict DRY (Don't Repeat Yourself) component organization, shared TypeScript types, and high-impact UX copywriting.
risk: unknown
date_added: 2026-08-07
---

# Fullstack Architect (Kuruttina)

Master architecture skill connecting **`discord-bot-architect`** (Discord.js v14 + PostgreSQL), **`frontend-architect`** (React + TypeScript Dashboard + Impeccable), and **`copywriting`** (High-Converting Copy & UX Messaging).

## Linked Workspace Skills

- **`discord-bot-architect`**: Handles bot gateway events, slash commands, interactive components, rate limiting, and sharding in TypeScript.
- **`frontend-architect`**: Handles React dashboard views, UI craft, Impeccable integration, accessibility, and visual polish.
- **`copywriting`**: Handles persuasive web copy, marketing copy, CTAs, headlines, value propositions, and INFJ voice consistency.

## Principles

1. **Strict DRY Policy (Don't Repeat Yourself)**:
   - Zero duplication of logic, TypeScript schemas, validation rules, or UI components.
   - Share types, constants, and API payload definitions between the Discord bot backend and the React dashboard frontend.
2. **Shared Package Data Sharing (`packages/shared`)**:
   - Store static defaults (e.g. `PLACEHOLDERS`, `DEFAULT_ROLE_GROUPS`, `DEFAULT_BOT_CONFIG`) inside `@kuruttina/shared` (`packages/shared/`) instead of making unnecessary database reads to Supabase.
3. **Component & Utility Organization**:
   - Organize components into dedicated directories grouped strictly by utility, domain, and reusable layer.
4. **Unified Full-Stack State**:
   - PostgreSQL serves as the single source of truth for dynamic bot runtime configurations and server settings.

## Shared Package (`packages/shared`) Structure

```
packages/shared/
├── src/
│   ├── placeholders.ts          # Shared Placeholders ({user}, {server}, {channel})
│   ├── roles.ts                 # Shared Default Role Groups (Admin, Mod, Member, Muted)
│   ├── constants.ts             # Bot Constants (Default Prefix k!, Domain)
│   └── index.ts                 # Export entry point
└── package.json                 # Shared package manifest (@kuruttina/shared)
```

## DRY Component & Copy Rules

- **Extract Primitive UI Elements**: Never write inline styled buttons or inputs repeatedly; reuse `components/ui/Button.tsx` and `components/ui/Input.tsx`.
- **Import Shared Placeholders & Roles**: Always import placeholders and role groups from `@kuruttina/shared` in both `apps/bot` (command rendering) and `apps/website` (dashboard UI editors).
- **Shared Type Definitions**: Define bot event payloads and API response contracts once in `@kuruttina/shared` and import them across apps.
