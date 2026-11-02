import { SlashCommandBuilder } from 'discord.js';

// Inválido: sem o bloco help, logo sem tópico.
export const command = {
  data: new SlashCommandBuilder().setName('semajuda').setDescription('Fixture sem help'),
  access: { kind: 'public' },
  scope: 'global',
  execute: async () => {},
};
