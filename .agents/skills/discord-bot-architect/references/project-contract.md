# Kuruttina project contract

This is the detailed reference for agents changing bot architecture, commands, events, shared utilities, deployment or operational behavior. The main skill routes here so ordinary tasks do not load this detail.

## Runtime map

The executable bot is apps/bot. It starts in src/index.ts, loads the root .env, creates KuruttinaClient and logs in with DISCORD_TOKEN.

KuruttinaClient extends discord.js Client and adds commands: Collection<string, CommandModule>.

The main client requests Guilds, GuildMessages, MessageContent and GuildMembers. The first three support slash/message handling; MessageContent and GuildMembers are privileged intents and must remain intentional.

The codebase is TypeScript with ES2022, NodeNext, strict mode and discord.js v14.x. The bot build is the authoritative compile check:

~~~bash
npm --prefix apps/bot run build
~~~

The root Turborepo also includes a React/Vite website. The root build currently reaches the bot and website packages but the website build is blocked when apps/website/index.html is absent. Do not fix or redesign the website while changing bot architecture.

## Repository shape

~~~text
apps/bot/src/
├── commands/
│   ├── public/
│   │   ├── admin/emojis/
│   │   ├── fun/games/
│   │   ├── moderation/actions/
│   │   └── utility/general/
│   └── developer/emojis/
├── events/
│   ├── client/lifecycle/
│   └── guild/
├── scripts/emojis/
├── types/
└── utils/
    ├── embeds/
    ├── emojis/
    ├── loaders/
    ├── Roleplay/
    ├── security/
    ├── time/
    └── users/
packages/shared/src/
Pictures/
└── Roleplay/
~~~

There is currently no affiliate command tree in the repository. deploy-commands.ts accepts an affiliate scope for compatibility, but current commands are divided into developer and public deployment groups.

## Command and event data flow

~~~text
Discord InteractionCreate ─┐
                           ├─> CommandContext ─> command.execute(ctx)
MessageCreate with k! ────┘

deploy-commands.ts ─> same command modules ─> Discord REST registration
~~~

index.ts discovers every .ts or .js file recursively under src/commands and src/events using utils/loaders/recursive-loader.ts.

The loader expects commandFile.command or commandFile.default. It expects eventFile.event or eventFile.default. Events are registered with Client.once when once is true, otherwise Client.on.

## Command contract

CommandModule in src/types/command-interface.ts currently requires:

~~~ts
interface CommandModule {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  prefixAliases?: string[];
  category: string;
  subCategory?: string;
  guide: CommandUsageGuide;
  execute: (ctx: CommandContext) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
~~~

A command file should expose one object:

~~~ts
export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('...'),
  prefixAliases: ['example', 'exemplo'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!example ou /example',
    examples: ['/example', 'k!example'],
  },
  async execute(ctx) {
    // Shared slash + prefix business logic.
  },
};
~~~

The prefix dispatcher matches the slash data name, a prefixAliases value, or the special dice pattern routed to roll. Every current slash command has a prefix alias and new commands must preserve this dual interface.

The guide is consumed by help. Keep syntax and examples accurate for both /command and k!command.

## CommandContext contract

CommandContext normalizes:

- isSlash
- slashInteraction or message
- channel and guild
- user
- args for prefix commands
- client
- memberPermissions
- deferReply(ephemeral?)
- reply(payload)

ReplyPayload is project-owned. It forwards content, APIEmbed arrays, components, files, ephemeral and allowedMentions to the Discord.js slash/message response. It defaults allowedMentions to parse: [].

If a new Discord payload is needed, extend ReplyPayload and forward it in both slash and message branches. Do not construct a second context abstraction for a command.

For local Roleplay GIFs, pass files with attachment: asset.absolutePath and a filename. The current Context supports this in both interfaces.

## Command execution rules

- Write business logic once in execute(ctx).
- Read slash-only values from ctx.slashInteraction and prefix values from ctx.args.
- Use ctx.deferReply() before work that may exceed Discord's acknowledgement window.
- Use ctx.reply() for normal responses.
- Prefer the utils barrel at apps/bot/src/utils/index.ts.
- Use discord.js API types and builders, not another Discord library.
- Do not use direct discord.py patterns or a second execution path.

## Shared utility map

Use the barrel unless changing an internal utility.

| Need | Utility |
|---|---|
| Application emoji resolution | utils/emojis/emoji-resolver.ts |
| Temporary secondary App Vault client | utils/emojis/multi-app-helper.ts |
| Embed and reply helpers | utils/embeds/embed-builder.ts |
| Recursive discovery | utils/loaders/recursive-loader.ts |
| Permission checks | utils/security/permission-guard.ts |
| Custom command execution | utils/security/custom-command-executor.ts |
| Target user from mention/ID/options | utils/users/user-resolver.ts |
| Duration parsing | utils/time/time-parser.ts |
| Roleplay GIF selection | utils/Roleplay/roleplay-resolver.ts |

packages/shared provides DEFAULT_BOT_CONFIG, emoji constants, sanitization, colors, cooldowns, custom IDs, i18n and terminal colors.

## Response and Discord conventions

- Define embeds and components as serializable Discord API objects.
- Send embeds through createKuruttinaEmbed from utils/embeds/embed-builder.ts.
- Use sendErrorReply and sendSuccessReply for standardized embed responses.
- Quick moderation success replies are concise content responses with the relevant emoji. Error responses may use the standard error helper.
- Use getEmojis(ctx.client) for several application emojis and access the returned object directly. Use getEmoji for one key.
- Use PermissionGuard and the command's Discord default member permissions together. Member actions must also check guild context, fresh bot/target members where hierarchy matters and the bot's effective permission.
- Use CooldownManager from @kuruttina/shared for per-user in-memory cooldowns. It does not coordinate across processes.
- Use resolveUser for mentions, raw snowflake IDs and slash-option target resolution.
- Use parseTimeString for durations and formatDuration or formatDurationHuman for display.
- Use withAppClient for temporary clients accessing secondary emoji vaults; the helper must destroy them.
- Never log or expose token values.

## REST deployment

deploy-commands.ts loads the same command modules and separates developer commands from public commands.

Useful scripts:

~~~bash
npm --prefix apps/bot run deploy
npm --prefix apps/bot run deploy:dev
npm --prefix apps/bot run deploy:public
npm --prefix apps/bot run deploy:clear
~~~

The deploy script performs a remote diff and only PUTs when command data changed, unless a fresh deploy is requested with --fresh or --clean-deploy. Deployment needs DISCORD_TOKEN, CLIENT_ID or DISCORD_CLIENT_ID, and DEV_GUILD_ID for developer commands.

## Operational boundaries

- No active database layer is used by the bot source today, even though Supabase is listed as a dependency.
- No sharding implementation exists.
- No distributed rate limiter exists; cooldowns are local memory.
- No formal automated test suite or bot lint script is present.
- Do not add architecture, dependencies or abstractions merely because a generic Discord guide recommends them.
- Tokens come from the root .env and must never be printed or documented.
- Long-running slash work must be deferred before API/network work.
- Secondary App Vault clients must be short-lived and destroyed by withAppClient.

## Minimal reading policy

- New command: this reference, one similar command and the relevant helper.
- New event: this reference, the matching event file, index.ts and the loader.
- New utility: this reference, its barrel export and one direct consumer.
- Emoji vault: this reference, multi-app helper and one relevant script.
- Roleplay: roleplay.md plus the resolver.
- Architecture change: this reference plus the exact files being changed.

Do not read every command, every emoji asset or the entire Discord.js documentation for a local change.

## Validation checklist

After bot code changes:

~~~bash
npm --prefix apps/bot run build
git diff --check
~~~

For command changes, verify data, category, guide, execute and at least one prefixAliases entry. For path or domain migrations, search both old and canonical names. For Roleplay changes, read roleplay.md and verify Pictures/Roleplay remains the only asset root.
