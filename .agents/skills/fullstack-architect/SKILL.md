---
name: fullstack-architect
description: Master skill linking discord-bot-architect and frontend-architect. Enforces full-stack architecture for Kuruttina, strict DRY (Don't Repeat Yourself) component organization, shared TypeScript types, and folder separation by utility.
risk: unknown
date_added: 2026-08-07
---

# Fullstack Architect (Kuruttina)

Master architecture skill connecting the **`discord-bot-architect`** (Discord.js v14 + PostgreSQL) and **`frontend-architect`** (React + TypeScript Dashboard + Impeccable).

## Linked Workspace Skills

- **`discord-bot-architect`**: Handles bot gateway events, slash commands, interactive components, rate limiting, and sharding in TypeScript.
- **`frontend-architect`**: Handles React dashboard views, UI craft, Impeccable integration, accessibility, and visual polish.

## Principles

1. **Strict DRY Policy (Don't Repeat Yourself)**:
   - Zero duplication of logic, TypeScript schemas, validation rules, or UI components.
   - Share types, constants, and API payload definitions between the Discord bot backend and the React dashboard frontend.
2. **Component & Utility Organization**:
   - Organize components into dedicated directories grouped strictly by utility, domain, and reusable layer.
3. **Unified Full-Stack State**:
   - PostgreSQL serves as the single source of truth for both bot runtime configurations and dashboard management.

## Component & Directory Separation by Utility

Organize code cleanly into utility-based folders:

```
src/
├── components/                  # React UI Components (Separated by utility)
│   ├── ui/                      # Base Atomic UI (Button, Input, Badge, Modal, Card)
│   ├── layout/                  # Shell Layouts (Sidebar, Header, PageContainer, Navigation)
│   ├── bot/                     # Bot Domain UI (BotStatusCard, GuildSelector, ModerationTable)
│   ├── forms/                   # Form Controls (FormGroup, ToggleSwitch, SelectInput)
│   └── feedback/                # Feedback & Status (SkeletonLoader, ErrorBanner, Toast)
├── hooks/                       # Shared Custom React Hooks (useBotStatus, useGuildConfig)
├── shared/                      # Full-Stack Shared Code (Used by Bot & Dashboard)
│   ├── types/                   # Shared TypeScript Interfaces (User, GuildConfig, Command)
│   ├── constants/               # Global Constants (BotPermissions, DefaultSettings)
│   └── utils/                   # Helper Utilities (Formatters, Validators, API Client)
```

## DRY Component Rules

- **Extract Primitive UI Elements**: Never write inline styled buttons or inputs repeatedly; reuse `components/ui/Button.tsx` and `components/ui/Input.tsx`.
- **Reusable Domain Components**: Components like `BotStatusCard` or `GuildSelector` live in `components/bot/` and are reused across different dashboard pages.
- **Shared Type Definitions**: Define bot event payloads and API response contracts once in `shared/types/` and import them in both command handlers and React components.

## When to Use

Use this skill when designing, organizing, or refactoring full-stack features that span both the Kuruttina Discord bot backend and the React web dashboard.
