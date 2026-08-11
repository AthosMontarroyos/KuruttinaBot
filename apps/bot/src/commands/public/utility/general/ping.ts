import { SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed } from '../../../../utils';

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

    // Resolve live emojis from Developer Portal concurrently
    const { DANCING, GATEWAY, API } = await getEmojis(ctx.client, ['DANCING', 'GATEWAY', 'API']);

    const pingEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${DANCING} Pong!`,
      fields: [
        {
          name: `${GATEWAY} Gateway Ping`,
          value: `\`${gatewayPing}ms\``,
          inline: true,
        },
        {
          name: `${API} API Ping`,
          value: `\`${apiPing}ms\``,
          inline: true,
        },
      ],
    });

    await ctx.reply({ embeds: [pingEmbed] });
  },
};

