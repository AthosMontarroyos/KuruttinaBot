import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// A subpasta chama-se public, mas a categoria continua sendo mod/.
export const command = {
  data: new SlashCommandBuilder().setName('aninhado').setDescription('Fixture válida da pasta mod'),
  access: {
    kind: 'guild',
    userPermissions: [PermissionFlagsBits.ManageMessages],
    botPermissions: [],
  },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
