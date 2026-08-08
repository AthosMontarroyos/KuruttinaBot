import { Client, ActivityType } from 'discord.js';
import { DEFAULT_BOT_CONFIG } from '@kuruttina/shared';

export const event = {
  name: 'ready',
  once: true,
  async execute(client: Client): Promise<void> {
    const botUser = client.user;
    if (!botUser) return;

    console.log(
      `⚡ [Kuruttina] Bot conectada com sucesso como ${botUser.tag}! (ID: ${botUser.id})`
    );
    console.log(
      `🎯 [Kuruttina] Personalidade: ${DEFAULT_BOT_CONFIG.PERSONALITY} | Prefixo Padrão: ${DEFAULT_BOT_CONFIG.DEFAULT_PREFIX}`
    );

    // Set presence status
    botUser.setPresence({
      activities: [
        {
          name: `${DEFAULT_BOT_CONFIG.DEFAULT_PREFIX}help | /ping`,
          type: ActivityType.Listening,
        },
      ],
      status: 'online',
    });
  },
};
