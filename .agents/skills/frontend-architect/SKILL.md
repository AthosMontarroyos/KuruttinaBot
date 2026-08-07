---
name: frontend-architect
description: Specialized skill for building modern, responsive React + TypeScript frontend interfaces and dashboards for KuruttinaBot. Integrates the Impeccable skill for UI craft, audits, visual polish, typography, and component design.
risk: unknown
date_added: 2026-08-07
---

# Frontend Architect (React + TypeScript)

Specialized skill for engineering production-ready React web interfaces and dashboards for KuruttinaBot. Incorporates the **Impeccable** design framework for visual craft, UI audits, micro-interactions, and design quality enforcement.

## Principles

- **TypeScript Type Safety**: All props, states, API payloads, and custom hooks must be strictly typed.
- **Component Modularity**: Divide UI into clear layers (Layouts, Views, Components, UI Elements).
- **Impeccable Integration**: Use the `impeccable` skill rules and tools for visual polish, audits (`audit`), styling hierarchy, and design detector feedback.
- **Dashboard Usability**: Prioritize scanability, responsiveness, dark mode elegance, and fast data updates for bot stats and guild configurations.
- **State Management & Async**: Clean data fetching (React Query / SWR / custom hooks) paired with PostgreSQL-backed API endpoints.

## Impeccable Integration Workflow

When designing, polishing, or auditing frontend components:
1. **Context & Brief**: Execute Impeccable context checks (`PRODUCT.md` and `DESIGN.md`) when creating new major dashboard views.
2. **Quality Floor (`craft-floor`)**: Enforce Impeccable quality standards — no browser defaults, clear visual hierarchy, accessible contrast ratios, and responsive layouts.
3. **Impeccable Commands**:
   - `shape`: Plan UX/UI flows before writing complex React components.
   - `critique` & `audit`: Evaluate accessibility, performance, and UI responsiveness.
   - `polish`, `bolder`, `quieter`: Refine visual aesthetics, typography, and color harmony.
   - `harden`: Ensure clean error boundaries, empty states, and fallback loaders.

## Dashboard Architecture & Patterns

For complete code examples and component templates, refer to [references/dashboard-patterns.md](references/dashboard-patterns.md).

### 1. Component Hierarchy
```
src/
├── components/
│   ├── ui/             # Buttons, Cards, Inputs, Modals, Badges
│   ├── layout/         # Sidebar, Header, PageContainer, Navigation
│   └── dashboard/      # GuildSelector, BotStats, ModerationLogs, ServerConfigForm
├── hooks/              # Custom hooks (useBotStatus, useGuildConfig, useAuth)
├── services/           # API clients & WebSocket listeners
├── types/              # TypeScript interfaces for API & Bot models
└── pages/              # Overview, GuildSettings, CommandsList, Analytics
```

### 2. State & Data Flow
- Use typed async hooks for fetching server state from PostgreSQL endpoints.
- Optimistic UI updates for quick user feedback on toggle switches (e.g. enabling bot features per guild).
- Real-time updates via WebSockets/SSE for live bot statistics and activity logs.

## Sharp Edges & Quality Checks

- **Missing Loading/Error States**: Always provide skeleton loaders and user-friendly error banners.
- **Unresponsive Controls**: Ensure sidebar and data tables adapt seamlessly to mobile and tablet viewports.
- **Hardcoded Colors & Magic Numbers**: Use CSS variables or design tokens defined in the theme.
- **Accessibility (a11y)**: Ensure interactive elements have accessible names, proper aria attributes, and keyboard focus indicators.

## When to Use

Use this skill when developing, refactoring, or auditing the React + TypeScript web dashboard and frontend interfaces for KuruttinaBot.
