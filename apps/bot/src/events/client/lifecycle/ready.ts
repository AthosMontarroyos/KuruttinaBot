import { Client, Events, ActivityType } from 'discord.js';
import { DEFAULT_BOT_CONFIG, loggerColors } from '@kuruttina/shared';
import { syncSlashCommands } from '../../../deploy-commands';

export const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client): Promise<void> {
    const botUser = client.user;
    if (!botUser) return;

    console.log(
      loggerColors.highlight(
        `⚡ [Kuruttina] Bot conectada com sucesso como ${botUser.tag}! (ID: ${botUser.id})`
      )
    );
    console.log(
      loggerColors.info(
        `🎯 [Kuruttina] Personalidade: ${DEFAULT_BOT_CONFIG.PERSONALITY} | Prefixo Padrão: ${DEFAULT_BOT_CONFIG.DEFAULT_PREFIX}`
      )
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

    // Automatically sync Slash Commands on startup
    await syncSlashCommands('all');
  },
};
