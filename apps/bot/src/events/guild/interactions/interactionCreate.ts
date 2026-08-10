import { Events, Interaction, APIEmbed } from 'discord.js';
import { EMBED_COLORS } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { KuruttinaClient } from '../../../types/kuruttina-client';

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as KuruttinaClient;
    const commandModule = client.commands.get(interaction.commandName);

    if (!commandModule) {
      console.warn(`⚠️ Comando não encontrado: ${interaction.commandName}`);
      return;
    }

    const ctx = new CommandContext(interaction);

    try {
      await commandModule.execute(ctx);
    } catch (error) {
      console.error(`❌ Erro ao executar o comando /${interaction.commandName}:`, error);

      const errorEmbed: APIEmbed = {
        title: '❌ Ocorreu um Erro',
        description: 'Ocorreu uma falha interna ao processar este comando. Tente novamente mais tarde.',
        color: EMBED_COLORS.BLACK.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
