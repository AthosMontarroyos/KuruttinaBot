import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('devguild').setDescription('Politica guild em dev'),
  access: { kind: 'guild', userPermissions: [PermissionFlagsBits.ManageMessages], botPermissions: [] },
  help: { topic: 'dev', examples: [{ slash: '/devguild', prefix: 'k!devguild' }] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
