import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('moddev').setDescription('Escopo dev-guild em mod'),
  access: { kind: 'guild', userPermissions: [PermissionFlagsBits.ManageMessages], botPermissions: [] },
  scope: 'dev-guild',
  execute: async () => {},
} satisfies ChatInputCommand;
