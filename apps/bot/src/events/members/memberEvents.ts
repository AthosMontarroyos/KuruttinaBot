import type { Channel, Guild, GuildMember, GuildTextBasedChannel, PartialGuildMember } from 'discord.js';
import { ACTION_VARIABLES, renderTemplate, type MessageTemplate } from '@kuruttina/message-templates';
import { log } from '#bot/infrastructure/logging/logger.js';
import { actionValuesFor } from '#bot/infrastructure/discord/messages/actionValues.js';
import { toCommandReply } from '#bot/infrastructure/discord/messages/toCommandReply.js';

/** Evento de membro com mensagem configurada: entrada ou saída do servidor. */
export type MemberEvent = 'join' | 'leave';

/** Porta mínima consumida pelo tratador: só a leitura da configuração de entrada e saída. */
export interface MemberEventsPort {
  readonly memberEvents: {
    get(guildId: string, event: MemberEvent): Promise<{
      enabled: boolean;
      channelId: string | null;
      ignoreBots: boolean;
      content: unknown;
    } | null>;
  };
}

/** Canal de servidor com `send`: exclui DM e grupo de DM, que não pertencem a nenhum servidor. */
function isGuildSendableChannel(channel: Channel): channel is GuildTextBasedChannel {
  return 'guildId' in channel && typeof channel.guildId === 'string' && 'send' in channel;
}

/** Canal de texto do próprio servidor onde a mensagem vai. Qualquer falha de busca vira `null`. */
async function resolveTextChannel(guild: Guild, channelId: string): Promise<GuildTextBasedChannel | null> {
  let channel: Channel | null | undefined;
  try {
    channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);
  } catch {
    return null;
  }
  if (!channel || !channel.isTextBased() || !isGuildSendableChannel(channel)) return null;
  return channel.guildId === guild.id ? channel : null;
}

/**
 * Envia a mensagem configurada quando um membro entra ou sai do servidor (ação de
 * membros do painel). Nunca lança: uma falha só gera log, sem conteúdo nem nome de usuário.
 */
export async function handleMemberEvent(
  event: MemberEvent,
  member: GuildMember | PartialGuildMember,
  database: MemberEventsPort,
): Promise<void> {
  try {
    const config = await database.memberEvents.get(member.guild.id, event);
    if (!config || !config.enabled || !config.channelId) return;
    // Bot entrando ou saindo não deve disparar a mensagem quando o servidor pediu para ignorar bots.
    if (member.user.bot && config.ignoreBots) return;

    const channel = await resolveTextChannel(member.guild, config.channelId);
    if (!channel) return;

    // Quem entrou ou saiu é o usuário das variáveis `{user.*}`; `{guild.membercount}` já vem atualizado pelo discord.js.
    const values = actionValuesFor(member.guild, member.user);
    const reply = toCommandReply(renderTemplate(config.content as MessageTemplate, ACTION_VARIABLES, values));
    // Menção em embed nunca notifica; só a do texto da mensagem, e só deste membro.
    const content = typeof reply === 'string'
      ? { content: reply, allowedMentions: { parse: [] as const, users: [member.id] } }
      : { ...reply, allowedMentions: { parse: [] as const, users: [member.id] } };
    await channel.send(content);
  } catch (error) {
    // Do not log message content or user names: canal apagado e falta de permissão caem aqui também.
    log('error', 'member_event_failed', {
      event,
      guildId: member.guild.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
