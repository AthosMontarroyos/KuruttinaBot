---
name: discord-bot-architect
description: Maintain and extend the Kuruttina Discord bot built with TypeScript, Node.js and discord.js v14. Use this skill for bot commands, events, loaders, Discord REST deployment, moderation, emoji vaults, inbound attachment/file validation, shared helpers and Roleplay assets.
metadata:
  short-description: Project-specific Discord.js architecture for Kuruttina
  project: Kuruttina
  runtime: discord.js-v14
  adapted-from: open community skill, narrowed to this repository
---

# Kuruttina Discord Bot Architecture

This is a project-specific router, not a generic Discord bot manual. It applies to apps/bot and packages/shared only.

## Non-negotiable project facts

- Runtime: TypeScript, Node.js, ES2022, NodeNext, strict mode and discord.js v14.x.
- Main entry: apps/bot/src/index.ts.
- Commands use the local CommandModule plus one shared CommandContext for slash and k! prefix execution.
- Commands and events are discovered recursively; do not create a second loader or command path.
- Imports should normally come from apps/bot/src/utils/index.ts.
- The main client currently uses Guilds, GuildMessages, MessageContent and GuildMembers.
- Default prefix is k!, with DEFAULT_PREFIX as the root .env override.
- Assets live under Pictures/; Roleplay assets live under Pictures/Roleplay/.
- There are currently no Roleplay commands; only the resolver and assets exist.
- The primary bot token belongs in the root `.env`; auxiliary emoji-vault tokens belong exclusively in the ignored `config/emoji-vaults.json`. Never log or document token values.

Do not add guidance or dependencies for discord.py, Next.js, Supabase/Postgres, sharding, distributed queues or distributed rate limiting unless the project explicitly adopts them. The website is a separate React/Vite application and is not governed by this bot skill.

## Progressive routing

Read only the reference needed for the task:

| Task | Read |
|---|---|
| Architecture, command/event contracts, Context, deployment, validation | references/project-contract.md |
| User attachments, file/image URLs, uploads or file integrity | references/file-auditing.md plus references/project-contract.md |
| Roleplay assets, gender routing or GIF commands | references/roleplay.md |
| New command or event | references/project-contract.md plus one neighboring implementation |
| Emoji vault or emoji scripts | references/project-contract.md plus the relevant utility/script |
| Website | frontend-architect or the relevant website skill |

Do not scan every command, every asset or the entire discord.js documentation for a local change.

## Mandatory implementation invariants

- A new command has data, category, guide, execute and at least one prefixAliases entry.
- Use one execute(ctx) implementation for slash and prefix behavior.
- Defer long slash operations before network/API work.
- Use CommandContext.reply for responses; preserve its default allowedMentions suppression.
- Use project helpers for embeds, emojis, target users, durations, permissions, cooldowns and secondary App Vault clients.
- Audit every user-controlled file before the bot downloads, decodes, persists, proxies, re-uploads or sends it to another API. Follow references/file-auditing.md; Discord attachments are not audited automatically.
- Keep embeds/components serializable as Discord API objects; do not introduce EmbedBuilder into commands.
- Keep quick moderation success replies concise content responses.
- Use resolveRoleplayAsset for Roleplay assets; do not duplicate directory or gender logic.
- Validate bot changes with npm --prefix apps/bot run build and git diff --check.

If a task changes the architecture itself, update references/project-contract.md with the new fact so future agents do not rediscover it from source.
