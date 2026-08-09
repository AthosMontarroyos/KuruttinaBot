import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmoji } from '../../../../utils/emoji-resolver';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Exibe a latência da Gateway e da API do Discord'),
  prefixAliases: ['ping', 'p'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!ping ou /ping',
    examples: ['/ping', 'k!ping'],
    detailedDescription: 'Verifica em tempo real a velocidade de resposta da WebSocket Gateway e a latência da API do Discord.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const gatewayPing = Math.round(ctx.client.ws.ping);
    const startMsgTime = Date.now();

    // Acknowledge interaction (3-second rule)
    await ctx.deferReply();

    const apiPing = Date.now() - startMsgTime;

    // Resolve live emojis from Developer Portal
    const dancingEmoji = await getEmoji(ctx.client, 'DANCING');
    const verifiedEmoji = await getEmoji(ctx.client, 'VERIFIED');

    // JS Object Notation (JSON format) embed for DB serializability & bot/dashboard sharing
    const pingEmbed: APIEmbed = {
      title: `${dancingEmoji} Pong!`,
      color: STATUS_COLORS.SUCCESS.number,
      fields: [
        {
          name: `${verifiedEmoji} Gateway Ping`,
          value: `\`${gatewayPing}ms\``,
          inline: true,
        },
        {
          name: `${verifiedEmoji} API Ping`,
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
