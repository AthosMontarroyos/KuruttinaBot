import { SlashCommandBuilder } from 'discord.js';
export const command = {
  data: new SlashCommandBuilder().setName('invalidstaff').setDescription('Invalid policy fixture'),
  access: { kind: 'staff', minimumRole: 'administrator', userPermissions: [], botPermissions: [] },
  help: { topic: 'dev', examples: [{ slash: '/invalidstaff', prefix: 'k!invalidstaff' }] },
  execute: async () => {},
};
