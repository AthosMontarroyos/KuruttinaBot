import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// Válido: sob `dev/` (em profundidade qualquer) com escopo dev-guild e política staff.
export const command = {
  data: new SlashCommandBuilder().setName('equipe').setDescription('Fixture válida da pasta dev'),
  access: { kind: 'staff', minimumRole: 'dev', userPermissions: [], botPermissions: [] },
  help: { topic: 'dev', examples: [{ slash: '/equipe', prefix: 'k!equipe' }] },
  scope: 'dev-guild',
  execute: async () => {},
} satisfies ChatInputCommand;
