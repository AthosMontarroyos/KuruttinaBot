---
name: frontend-architect
description: Specialized skill for building modern, responsive React + TypeScript frontend interfaces and dashboards for KuruttinaBot. Integrates the Impeccable skill for UI craft and the Copywriting skill for persuasive UX copy, headlines, and CTAs.
risk: unknown
date_added: 2026-08-07
---

# Frontend Architect (React + TypeScript)

Specialized skill for engineering production-ready React web interfaces and dashboards for KuruttinaBot. Incorporates the **Impeccable** design framework for visual craft, UI audits, micro-interactions, and the **Copywriting** skill for persuasive headlines, CTAs, and onboarding UX text.

## Principles

- **TypeScript Type Safety**: All props, states, API payloads, and custom hooks must be strictly typed.
- **Component Modularity**: Divide UI into clear layers (Layouts, Views, Components, UI Elements).
- **Impeccable Integration**: Use the `impeccable` skill rules and tools for visual polish, audits (`audit`), styling hierarchy, and design detector feedback.
- **Copywriting Integration**: Apply the `copywriting` skill for all customer-facing text, landing page copy, value propositions, hero headlines, feature titles, empty states, and Call to Actions (CTAs).
- **Dashboard Usability**: Prioritize scanability, responsiveness, dark mode elegance, and fast data updates for bot stats and guild configurations.
- **State Management & Async**: Clean data fetching (React Query / SWR / custom hooks) paired with PostgreSQL-backed API endpoints.

## Copywriting & UX Copy Integration

When building or refining user-facing interfaces, landing pages, and dashboard views:
- **Hero & Landing Copy**: Craft punchy, benefit-driven main headlines, subheadlines, and value propositions.
- **CTAs (Call to Actions)**: Write compelling, action-oriented button text (e.g., "Adicionar Kuruttina", "Configurar Servidor").
- **Feature Copy & Onboarding**: Use clear signposting and natural transitions (referencing `references/natural-transitions.md`) to guide users seamlessly through setup flows.
- **INFJ Tone & Voice**: Infuse Kuruttina's INFJ personality (empathetic, insightful, principled, protective, sagaciously witty) into UI messages, toast notifications, empty states, and error callouts.

## Context Artifacts: PRODUCT.md & DESIGN.md

Understanding the role and lifecycle of context artifacts in Impeccable:

### 1. `PRODUCT.md` (Product Context & Goals)
- **Purpose**: Captures durable product context — target audience, core features, value proposition, user flows, business goals, and platform constraints.
- **Role in Kuruttina**: Outlines the Discord bot dashboard's goals (guild management, moderation controls, live bot telemetry, user role preferences, and API integration).
- **Lifecycle**: Created via Impeccable's `init` or `teach` command. **Do NOT create this file prematurely**; only initialize it when explicitly requested by the user or when starting initial frontend onboarding.

### 2. `DESIGN.md` (Visual System & Design Tokens)
- **Purpose**: Captures the visual world, design tokens, color palette, typography hierarchy, materials, motion language, and design mode.
- **Design Mode for Kuruttina**: **Operate Mode** (Focused on task execution, high scanability, dark mode elegance, data density, responsive controls, and native-feeling dashboard UI).
- **Lifecycle**: Created via Impeccable's `document` or `new-work` flow when establishing or updating the project's visual identity. **Do NOT create this file prematurely**; wait for explicit instruction or when setting up the visual system.

## Impeccable Integration Workflow

When designing, polishing, or auditing frontend components:
1. **Context & Brief**: Check for `PRODUCT.md` and `DESIGN.md` when building major views (if they exist).
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
│   ├── layout/          # Shell, Navigation, Sidebar, Header
│   ├── views/           # Full Page Views (Dashboard, ServerConfig, BotStats)
│   ├── modules/         # Domain Modules (ModerationLogs, RoleManager, WelcomeEditor)
│   └── ui/              # Reusable Base Components (Button, Card, Input, Badge)
```
