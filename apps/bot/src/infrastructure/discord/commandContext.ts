import type { GuildTextBasedChannel, TextBasedChannel } from 'discord.js';
import type { CommandContext, HasPermission } from '#bot/commands/types.js';
import { createClearChannelAdapter } from './clearAdapter.js';

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
  Anger: '😠',
  Disappointed: '😞',
  ops: '😅',
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

function isGuildTextChannel(channel: TextBasedChannel | null | undefined): channel is GuildTextBasedChannel {
  return channel != null && !channel.isDMBased() && 'bulkDelete' in channel;
}

export function createChannelContext(
  channel: TextBasedChannel | null | undefined,
  memberPermissions?: HasPermission,
  appPermissions?: HasPermission,
): Pick<CommandContext, 'textChannel' | 'channelId' | 'guildId' | 'memberPermissions' | 'appPermissions' | 'sendMessage'> {
  if (!isGuildTextChannel(channel)) return {};
  const botMember = channel.guild.members.me;
  return {
    textChannel: createClearChannelAdapter(channel),
    channelId: channel.id,
    guildId: channel.guild.id,
    memberPermissions,
    appPermissions: appPermissions ?? (botMember ? channel.permissionsFor(botMember) ?? undefined : undefined),
    sendMessage: (content) => channel.send(content),
  };
}
