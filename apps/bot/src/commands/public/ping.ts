import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand, CommandContext } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Mostra a latencia da API e do Gateway'),
  access: { kind: 'public' },
  scope: 'global',
  async execute(context: CommandContext): Promise<void> {
    await context.reply(await context.render('ping.reply', {
      api: String(context.apiPing),
      gateway: String(context.gatewayPing),
    }));
  },
} satisfies ChatInputCommand;
