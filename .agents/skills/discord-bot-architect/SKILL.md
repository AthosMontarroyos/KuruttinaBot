---
name: discord-bot-architect
description: Specialized skill for building production-ready Discord bots. Covers Discord.js (TypeScript/JavaScript), gateway intents, dual slash/prefix commands, rate limiting, PostgreSQL/Supabase integration, React dashboards, and sharding.
risk: unknown
source: vibeship-spawner-skills (Apache 2.0)
date_added: 2026-02-27
---

# Discord Bot Architect

Specialized skill for building production-ready Discord bots and web dashboards.
Covers Discord.js with TypeScript, PostgreSQL/Supabase database integrations, React web interfaces, gateway intents, dual Slash & Prefix commands (Default Prefix: `k!`), interactive components, rate limiting, and sharding.

## Principles

- **TypeScript First**: Enforce type safety across command handlers, event listeners, and API contracts.
- **Categorized Folder Structure**: Commands and events MUST be organized into nested category and sub-category directories (e.g. `src/commands/moderation/actions/ban.ts`, `src/events/client/lifecycle/ready.ts`).
- **Recursive Event/Command Loading**: Use recursive file loaders to discover and register all commands/events dynamically regardless of directory nesting depth.
- **Dual Command Requirement (Slash + Prefix `k!`)**: Slash commands are the default standard interface (`/command`), but **EVERY Slash Command MUST ALSO have a corresponding Prefix Command counterpart using default prefix `k!`** (e.g. `k!ping`, `k!ban`, `k!config`).
- **DRY Shared Command Execution**: Use a shared `CommandContext` abstraction so the core business logic is written ONCE and consumed by both Slash Interaction (`ChatInputCommandInteraction`) and Prefix Message (`Message`) handlers.
- **3-Second Acknowledgment Rule**: Acknowledge interactions within 3 seconds, using `deferReply()` for operations >3s.
- **Request Minimal Intents**: Request only required intents (minimize privileged intents).
- **Supabase / PostgreSQL Persistence**: Store bot settings, guild custom prefixes, user profiles, and logs securely with parameterized queries / Supabase SDK.
- **React Dashboard**: Build modern web dashboards for bot management using React with TypeScript.
- **JavaScript Object (JSON Format) for Embeds & Components V2**: All Embeds and Components V2 MUST be defined as raw JavaScript Objects / JSON structures (`APIEmbed`, `APIActionRowComponent`, `APIButtonComponent` or `{ title, description, color, fields, components }`). This guarantees 100% serializability to Supabase DB and seamless exportability/sharing between the Bot and Web Dashboard.
- **Batch Emoji Resolution (`getEmojis`)**: Use `getEmojis(client, ['KEY1', 'KEY2', ...])` (`src/utils/emoji-resolver.ts`) to resolve multiple Application Emojis concurrently via `Promise.all` in a single destructurable call (`const { CROWN, SHIELD } = await getEmojis(client, ['CROWN', 'SHIELD'])`), avoiding repetitive sequential `await getEmoji(...)` statements.
- **Standardized Embed Factory (`createKuruttinaEmbed`) & Ephemeral Reply Helpers**: All Discord embeds MUST be constructed via `createKuruttinaEmbed(client, options)` (`src/utils/embed-builder.ts`), enforcing Rule 16 minimalist side borders (strictly Black `#000001` or White `#FFFFFF`), dynamic bot avatar, and ISO timestamp. For command replies, use `sendErrorReply(ctx, title, description)` and `sendSuccessReply(ctx, title, description, fields)` to eliminate duplicate embed building boilerplate.
- **Ephemeral Multi-App Client Lifecycle Helper (`withAppClient`)**: Multi-App REST client operations across secondary emoji vaults MUST use `withAppClient(token, async (client) => { ... })` (`src/utils/multi-app-helper.ts`), ensuring automatic login, `ClientReady` handling, and deterministic `client.destroy()` in a `finally` block to prevent memory leaks.
- **Dynamic CLI Script Argument Parsing**: All CLI scripts in `src/scripts/` MUST parse CLI arguments dynamically via `process.argv` and log clear usage instructions (`📌 Uso: npx ts-node ...`) when arguments are missing. CLI scripts MUST NOT contain hardcoded test targets or target filenames.
- **Deep Research & Documentation**: Whenever encountering unfamiliar Discord.js features, methods, or version-specific details, perform web searches against official Discord.js documentation (`discord.js.org` / `discordjs.dev`).

## Command & Event Directory Hierarchy

Organize handlers into clear category and sub-category folders:

```
src/
├── commands/                      # Dual Slash & Prefix Commands
│   ├── public/                    # Scope: Public Commands (Global production commands)
│   │   ├── utility/               # Category: Utility
│   │   │   └── general/
│   │   │       └── ping.ts
│   │   ├── moderation/            # Category: Moderation
│   │   │   └── actions/
│   │   └── admin/                 # Category: Admin
│   │       └── settings/
│   ├── developer/                 # Scope: Developer Commands (Dev Guild & Creator commands)
│   │   ├── emojis/
│   │   │   └── dev-emoji-add.ts
│   │   └── system/
│   └── affiliate/                 # Scope: Affiliate Commands (Custom partner server commands)
│       └── custom/
├── events/                        # Event Handlers
│   ├── client/                    # Category: Client
│   │   └── lifecycle/             # Sub-category: Lifecycle
│   │       ├── ready.ts
│   │       └── shardReady.ts
│   ├── guild/                     # Category: Guild
│   │   ├── message/               # Sub-category: Message (Prefix Command Dispatcher - listens for k!)
│   │   │   └── messageCreate.ts
│   │   └── interactions/          # Sub-category: Interactions (Slash Command Dispatcher)
│   │       └── interactionCreate.ts
```

## Dual Command Pattern (Slash + Prefix `k!`)

Every command module exports:
1. `data`: `SlashCommandBuilder` definition for Discord Slash Registration.
2. `prefix`: String array or primary name for Prefix Command matching with default prefix `k!` (e.g. `k!ping`, `k!p`).
3. `execute`: Unified execution handler receiving a normalized `CommandContext`.

### Unified Execution Pattern Example (TypeScript)

```ts
import { SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../types/command-context';
import { CommandModule } from '../../types/command-interface';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Exibe a latência da Kuruttina e da API do Discord'),
  prefixAliases: ['ping', 'p', 'latencia'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!ping ou /ping',
    examples: ['/ping', 'k!ping'],
    detailedDescription: 'Exibe a velocidade de resposta da Gateway e API do Discord.',
  },
  
  // Shared execution logic (DRY)
  async execute(ctx: CommandContext) {
    const wsPing = ctx.client.ws.ping;
    await ctx.reply({
      content: `🏓 **Pong!** Latência da WebSocket: \`${wsPing}ms\``,
    });
  },
};
```
