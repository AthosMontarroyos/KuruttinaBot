import { Interaction, Collection, EmbedBuilder } from 'discord.js';
import { STATUS_COLORS } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';

// Extended Client type carrying commands collection
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, CommandModule>;
  }
}

export const event = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const command = interaction.client.commands.get(commandName);

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
