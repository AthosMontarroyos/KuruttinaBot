import { PermissionFlagsBits } from 'discord.js';
import type { AccessDenialMessages, CommandAccess, CommandContext } from './types.js';

/** Monta a fala unindo emojis do bot e texto, omitindo emoji que não pôde ser resolvido. */
export function withEmojis(...parts: string[]): string {
  return parts.filter((part) => part !== '').join(' ');
}

/** Portuguese names for permission bits shown in denial messages. */
const permissionLabels: Partial<Record<keyof typeof PermissionFlagsBits, string>> = {
  ViewChannel: 'Ver canal',
  ReadMessageHistory: 'Ler histórico',
  ManageMessages: 'Gerenciar mensagens',
  SendMessages: 'Enviar mensagens',
  SendMessagesInThreads: 'Enviar mensagens',
};

const labelsByPermission = new Map<bigint, string>(
  Object.entries(PermissionFlagsBits).map(([name, permission]): [bigint, string] => [
    permission,
    permissionLabels[name as keyof typeof PermissionFlagsBits]
      ?? name.replace(/([a-z])([A-Z])/gu, '$1 $2'),
  ]),
);

function permissionLabel(permission: bigint): string {
  return labelsByPermission.get(permission) ?? 'Permissão';
}

function permissionList(permissions: readonly bigint[]): string {
  return permissions.map(permissionLabel).join(', ');
}

/** Generic denial copy; a command may override parts of it in its own policy. */
const defaultMessages: AccessDenialMessages = {
  guildOnly: 'Este comando só pode ser usado em canais de texto de servidor.',
  userUnavailable: 'Não consegui conferir suas permissões. Tente novamente!',
  userMissing: 'Você precisa da permissão **{permissions}** neste canal.',
  botUnavailable: 'Não consegui conferir minhas permissões neste canal. Tente novamente!',
  botMissing: 'Preciso destas permissões para executar este comando: **{permissions}**.',
};

async function denial(context: CommandContext, emojiName: string, text: string): Promise<string> {
  return withEmojis(await context.emoji(emojiName), text);
}

/**
 * Validates the declared policy against effective channel permissions.
 * Returns the denial reply, or null when execution may proceed.
 * Missing permission context fails closed for guild commands.
 */
export async function validateCommandAccess(
  access: CommandAccess,
  context: CommandContext,
): Promise<string | null> {
  if (access.kind === 'public') return null;
  const messages: AccessDenialMessages = { ...defaultMessages, ...access.messages };

  if (!context.textChannel) return denial(context, 'ChannelBrowser', messages.guildOnly);

  const userPermissions = context.memberPermissions;
  if (!userPermissions) return denial(context, 'ops', messages.userUnavailable);
  const missingUser = access.userPermissions.filter((permission) => !userPermissions.has(permission, true));
  if (missingUser.length > 0) {
    return denial(context, 'Disappointed', messages.userMissing.replaceAll('{permissions}', permissionList(missingUser)));
  }

  const botPermissions = context.appPermissions;
  if (!botPermissions) return denial(context, 'ops', messages.botUnavailable);
  const requiredBotPermissions = access.requireChannelSend
    ? [
        ...access.botPermissions,
        context.textChannel.isThread ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages,
      ]
    : access.botPermissions;
  const missingBot = requiredBotPermissions.filter((permission) => !botPermissions.has(permission, true));
  if (missingBot.length > 0) {
    return denial(context, 'Anger', messages.botMissing.replaceAll('{permissions}', permissionList(missingBot)));
  }

  return null;
}
