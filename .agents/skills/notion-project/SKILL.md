---
name: notion-project
description: Maintain Kuruttina project planning in Notion by updating the project record, creating linked tasks, and verifying project relations.
metadata:
  short-description: Notion workflow for the Kuruttina project
  project: Kuruttina
---

# Kuruttina Notion Workflow

Use this skill when a task asks an agent to locate, update, or extend the Kuruttina project records in Notion, especially project context, execution tasks, or durable project decisions.

## Canonical records

The connected Notion workspace is **Kurutta**. These are the current records for this repository:

- Root page: [Início](https://app.notion.com/p/3c1f122a9b1b817592cff807b1c3e190)
- System hub: [Sistema](https://app.notion.com/p/3c1f122a9b1b819db479d5ca20b0833e)
- Project database: [Projetos](https://app.notion.com/p/731bee9645964566815d5e200ba5ef92)
- Project page: [KuruttinaBot](https://app.notion.com/p/3c1f122a9b1b81a5aad7c38a0d6e8a83)
- Task database: [Tarefas](https://app.notion.com/p/d32e142b914246918244b08fc78af7d1)
- Project data source: `collection://95dfdf09-4973-418e-a2bb-81819a9804df`
- Task data source: `collection://0fa22fed-f178-46fb-9eb8-b6123e6559e2`
- Repository: [AthosMontarroyos/KuruttinaBot](https://github.com/AthosMontarroyos/KuruttinaBot)

These IDs are lookup hints, not a substitute for discovery. Fetch the database before creating database-backed pages so the current schema and data-source ID are authoritative.

## Safe workflow

1. Read the repository context first: `.agents/AGENTS.md`, `README.md`, `PRODUCT.md`, and only the source files relevant to the requested update.
2. Never read, copy, or emit secret values from `.env`. Environment variable names may be documented, but tokens, keys, passwords, connection strings, and private operational values must remain local.
3. Search Notion with one literal query at a time and `filters: {}` when no narrower filter is needed. Fetch the returned page or database before changing it.
4. Reuse the existing `KuruttinaBot` page. Do not create a duplicate project page when the canonical page already exists.
5. For database-backed pages, fetch the database first and create with the returned `data_source_id`. Use exact property names and option values from the schema.
6. After every mutation, fetch the changed page or query the relevant data source to verify the title, status, relations, and task contents.

## Project page contract

Keep the project page useful as a durable handoff. Include, when applicable:

- project purpose, audience, positioning, and current status;
- repository and deployment links;
- architecture, monorepo layout, runtime, integrations, and asset locations;
- current capabilities, explicit non-goals, constraints, and known gaps;
- security, privacy, credential, and file-handling rules without secret values;
- validation commands, operational notes, and the next concrete steps;
- links to the `Tarefas` database and related knowledge pages.

The Notion record is named `KuruttinaBot` for continuity. In code, UI, and user-facing documentation, follow the repository naming rule that the bot itself is **Kuruttina**.

## Task creation contract

Create project work in the `Tarefas` data source, not as an unlinked child page. The current schema uses:

- title: `Tarefa`;
- select properties: `Status`, `Tipo`, `Área`, and `Prioridade`;
- relation: `Projeto` pointing to the `KuruttinaBot` project page;
- optional date: `Prazo`.

For a security audit, use `Status: A fazer`, `Tipo: Revisão`, and `Área: Programação` unless the user gives different values. Set priority from the stated risk; security work with no other priority normally deserves `Alta`. The task body should state the context, audit scope, expected evidence, acceptance criteria, and follow-up action.

When a task is related to a project, set its `Projeto` relation to the project page ID. The reciprocal `Tarefas` relation may be synchronized automatically; verify it before manually updating the project property.

## Notion content rules

- Before creating or editing content, fetch `notion://docs/enhanced-markdown-spec` and use its Notion-flavored Markdown.
- For an existing page, fetch the current content and use an exact `update_content` replacement or a full `replace_content` when the complete document is intentionally refreshed.
- Use `<mention-page>` for references to existing pages. Use `<page>` only when intentionally creating or moving a child page.
- Do not put a page title as a heading in its own content; set it through the title property.
- If Notion tools are unavailable, stop and ask for the Notion connection instead of fabricating a local result.

## Local project linkage

This skill is intentionally stored at `.agents/skills/notion-project/SKILL.md` and must remain listed in `.agents/AGENTS.md`. Keep the link relative so the repository remains portable across machines.
