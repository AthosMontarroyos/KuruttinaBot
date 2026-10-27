import type { GuildTextBasedChannel, TextBasedChannel } from 'discord.js';
import type { CommandContext, HasPermission } from '#bot/command-system/types.js';
import { MESSAGE_CATALOG, type MessageCatalogEntry, type MessageKey } from '#bot/application/messages/catalog.js';
import { fillEmojis, renderTemplate } from '@kuruttina/message-templates';
import { toCommandReply } from '../messages/toCommandReply.js';
import { createClearChannelAdapter } from '../moderation/clearAdapter.js';
import { createMemberModerationAdapter } from '../moderation/memberModerationAdapter.js';

export interface CommandClientPort {
  readonly application: { readonly emojis: {
    fetch(): Promise<{ find(predicate: (emoji: { name: string | null }) => boolean): { toString(): string } | undefined }>;
  } };
  readonly ws: { readonly ping: number };
}

/** Alternativas Unicode. `slap` fica de fora: é complemento e some quando indisponível. */
const emojiFallbacks: Readonly<Record<string, string>> = {
  dancing: '💃',
  stats: '📊',
  gateway: '🌐',
  warning: '⚠️',
  loading: '⏳',
  cleaning: '🧹',
  error: '❌',
  search: '🔎',
  add: '➕',
  sucess: '✅',
  Angry: '😠',
  Disappointed: '😞',
  cry: '😢',
  ops: '😅',
  question: '❓',
  ChannelBrowser: '🏘️',
  guild: '🏘️',
  ID: '🪪',
  developer: '🧑‍💻',
  lock: '🔒',
  book: '📖',
  coffee: '☕',
  photo: '🖼️',
  label: '🏷️',
  shield: '🛡️',
};

export function createEmojiResolver(application: CommandClientPort['application']): CommandContext['emoji'] {
  // One request per command, including concurrent lookups and failed requests.
  let emojis: ReturnType<typeof application.emojis.fetch> | undefined;
  return async (name) => {
    try {
      const collection = await (emojis ??= application.emojis.fetch());
      return collection.find((emoji) => emoji.name === name)?.toString() ?? emojiFallbacks[name] ?? '';
    } catch {
      return emojiFallbacks[name] ?? '';
    }
  };
}

/** Cria o `render` do contexto, reutilizando o `emoji` (e seu cache) do comando. */
export function createRenderer(emoji: CommandContext['emoji']): CommandContext['render'] {
  return async (key: MessageKey, values = {}) => {
    if (!Object.hasOwn(MESSAGE_CATALOG, key)) throw new Error(`Fala desconhecida no catálogo: ${String(key)}`);
    const entry = (MESSAGE_CATALOG as Readonly<Record<string, MessageCatalogEntry>>)[key] as MessageCatalogEntry;
    const aliases = Object.entries(entry.emojis);
    const resolved = await Promise.all(aliases.map(([, name]) => emoji(name)));
    const emojis = Object.fromEntries(aliases.map(([alias], index) => [alias, resolved[index] ?? '']));
    return toCommandReply(renderTemplate(fillEmojis(entry.template, emojis), entry.variables, values));
  };
}

function isGuildTextChannel(channel: TextBasedChannel | null | undefined): channel is GuildTextBasedChannel {
  return channel != null && !channel.isDMBased() && 'bulkDelete' in channel;
}

export function createChannelContext(
  channel: TextBasedChannel | null | undefined,
  memberPermissions?: HasPermission,
  appPermissions?: HasPermission,
): Pick<CommandContext, 'textChannel' | 'channelId' | 'guildId' | 'memberPermissions' | 'appPermissions' | 'sendMessage' | 'memberModeration'> {
  if (!isGuildTextChannel(channel)) return {};
  const botMember = channel.guild.members.me;
  return {
    textChannel: createClearChannelAdapter(channel),
    channelId: channel.id,
    guildId: channel.guild.id,
    memberPermissions,
    appPermissions: appPermissions ?? (botMember ? channel.permissionsFor(botMember) ?? undefined : undefined),
    sendMessage: (content) => channel.send(content),
    memberModeration: createMemberModerationAdapter(channel.guild),
  };
}
