import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand, CommandContext } from '#bot/commands/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Mostra a latencia da API e do Gateway'),
  async execute(context: CommandContext): Promise<void> {
    const [dancing, stats, gateway] = await Promise.all([
      context.emoji('dancing'),
      context.emoji('stats'),
      context.emoji('gateway'),
    ]);
    await context.reply({
      content: `${dancing} Pong!`,
      embeds: [{
        color: 0x2b2d31,
        fields: [
          {
            name: `${stats} API`,
            value: `\`${context.apiPing}ms\``,
            inline: true,
          },
          {
            name: `${gateway} Gateway`,
            value: `\`${context.gatewayPing}ms\``,
            inline: true,
          },
        ],
      }],
    });
  },
} satisfies ChatInputCommand;
