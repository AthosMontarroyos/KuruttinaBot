import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Exibe a latência da Gateway e da API do Discord'),
  prefixAliases: ['ping', 'p', 'latencia'],
  category: 'utility',
  subCategory: 'general',

  async execute(ctx: CommandContext): Promise<void> {
    const gatewayPing = Math.round(ctx.client.ws.ping);
    const startMsgTime = Date.now();

    // Acknowledge interaction (3-second rule)
    await ctx.deferReply();

    const apiPing = Date.now() - startMsgTime;

    // JS Object Notation (JSON format) embed for DB serializability & bot/dashboard sharing
    const pingEmbed: APIEmbed = {
      title: '🏓 Pong!',
      color: STATUS_COLORS.SUCCESS.number,
      fields: [
        {
          name: '🌐 Gateway Ping',
          value: `\`${gatewayPing}ms\``,
          inline: true,
        },
        {
          name: '⚡ API Ping',
          value: `\`${apiPing}ms\``,
          inline: true,
        },
      ],
      footer: {
        text: DEFAULT_BOT_CONFIG.BOT_NAME,
        icon_url: ctx.client.user?.displayAvatarURL(),
      },
      timestamp: new Date().toISOString(),
    };

    await ctx.reply({ embeds: [pingEmbed] });
  },
};
