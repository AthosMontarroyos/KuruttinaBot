import { Interaction, Events, EmbedBuilder } from 'discord.js';
import { STATUS_COLORS } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { KuruttinaClient } from '../../../types/kuruttina-client';

export const event = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as KuruttinaClient;
    const commandName = interaction.commandName;
    const command = client.commands.get(commandName);

    if (!command) {
      console.warn(`⚠️ [Kuruttina] Comando Slash desconhecido recebido: ${commandName}`);
      return;
    }

    const ctx = new CommandContext(interaction);

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error(
        `❌ [Kuruttina] Erro ao executar o comando Slash /${commandName}:`,
        error
      );

      const errorEmbed = new EmbedBuilder()
        .setColor(STATUS_COLORS.ERROR.number)
        .setTitle('❌ Ocorreu um Erro')
        .setDescription(
          'Ocorreu uma falha interna ao processar este comando. Tente novamente mais tarde.'
        );

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
