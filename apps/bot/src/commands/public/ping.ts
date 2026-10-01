import { SlashCommandBuilder } from 'discord.js';
import { withEmojis } from '#bot/commands/access.js';
import type { ChatInputCommand, CommandContext } from '#bot/commands/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Mostra a latencia da API e do Gateway'),
  access: { kind: 'public' },
  scope: 'global',
  async execute(context: CommandContext): Promise<void> {
    const [dancing, stats, gateway] = await Promise.all([
      context.emoji('dancing'),
      context.emoji('stats'),
      context.emoji('gateway'),
    ]);
    await context.reply({
      content: withEmojis(dancing, 'Pong. Ainda estou aqui.'),
      embeds: [{
        color: 0x2b2d31,
        fields: [
          {
            name: withEmojis(stats, 'API'),
            value: `\`${context.apiPing}ms\``,
            inline: true,
          },
          {
            name: withEmojis(gateway, 'Gateway'),
            value: `\`${context.gatewayPing}ms\``,
            inline: true,
          },
        ],
      }],
    });
  },
} satisfies ChatInputCommand;
