import { SlashCommandBuilder } from 'discord.js';

// Simula um módulo que contorna o contrato TypeScript: o loader ainda deve rejeitá-lo.
export const command = {
  data: new SlashCommandBuilder().setName('sem-acesso').setDescription('Modulo sem politica de acesso'),
  help: { topic: 'public', examples: [{ slash: '/sem-acesso', prefix: 'k!sem-acesso' }] },
  async execute(): Promise<void> {},
};
