import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Exibe a latência de resposta da Kuruttina e da API do Discord'),
  prefixAliases: ['ping', 'p', 'latencia'],
  category: 'utility',
  subCategory: 'general',

  async execute(ctx: CommandContext): Promise<void> {
    const wsLatency = Math.round(ctx.client.ws.ping);
    const startMsgTime = Date.now();

    // Acknowledge interaction (3-second rule)
    await ctx.deferReply();

    const responseLatency = Date.now() - startMsgTime;

    const pingEmbed = new EmbedBuilder()
      .setColor(STATUS_COLORS.SUCCESS.number)
      .setTitle('🏓 Pong! Latência da Kuruttina')
      .setDescription(
        `Pensou que eu ia demorar? A velocidade da minha mente é imbatível! 😉`
      )
      .addFields(
        {
          name: '📡 Latência da WebSocket',
          value: `\`${wsLatency}ms\``,
          inline: true,
        },
        {
          name: '⚡ Latência da Resposta',
          value: `\`${responseLatency}ms\``,
          inline: true,
        },
        {
          name: '🤖 Status da Bot',
          value: `\`Online & Operacional\``,
          inline: true,
        }
      )
      .setFooter({
        text: `${DEFAULT_BOT_CONFIG.BOT_NAME} — Proteção Visionária & INFJ Persona`,
        iconURL: ctx.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    await ctx.reply({ embeds: [pingEmbed] });
  },
};
