import type { Guild, User } from 'discord.js';
import { buildActionValues } from '@kuruttina/message-templates';

/**
 * Valores das variáveis de ação (`ACTION_VARIABLES`) a partir de objetos do
 * discord.js. Sem `user`, as variáveis `user.*` renderizam vazias.
 */
export function actionValuesFor(guild: Guild, user?: User, now: Date = new Date()): Record<string, string> {
  return buildActionValues({
    user: user ? { id: user.id, name: user.displayName, avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }) } : null,
    guild: {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ extension: 'png', size: 256 }),
      bannerUrl: guild.bannerURL({ extension: 'png', size: 1024 }),
      memberCount: guild.memberCount,
    },
    now,
  });
}
