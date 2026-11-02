import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('publicguild').setDescription('Politica guild em public'),
  access: { kind: 'guild', userPermissions: [PermissionFlagsBits.ManageMessages], botPermissions: [] },
  help: { topic: 'public', examples: [{ slash: '/publicguild', prefix: 'k!publicguild' }] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
