import { Events, Interaction } from 'discord.js';
import { CommandContext } from '../../../types/command-context';
import { KuruttinaClient } from '../../../types/kuruttina-client';
import { getEmoji, createKuruttinaEmbed } from '../../../utils';

export const event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    const client = interaction.client as KuruttinaClient;

    if (interaction.isAutocomplete()) {
      const commandModule = client.commands.get(interaction.commandName);
      if (!commandModule?.autocomplete) return;

      try {
        await commandModule.autocomplete(interaction);
      } catch (error) {
        console.error('❌ Erro no autocomplete do comando /' + interaction.commandName + ':', error);
        if (!interaction.responded) await interaction.respond([]);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const commandModule = client.commands.get(interaction.commandName);
    if (!commandModule) {
      console.warn('⚠️ Comando não encontrado: ' + interaction.commandName);
      return;
    }

    const ctx = new CommandContext(interaction);

    try {
      await commandModule.execute(ctx);
    } catch (error) {
      console.error('❌ Erro ao executar o comando /' + interaction.commandName + ':', error);

      const errorEmoji = await getEmoji(client, 'ERROR');
      const errorEmbed = createKuruttinaEmbed(client, {
        title: errorEmoji + ' Ocorreu um Erro',
        description: 'Ocorreu uma falha interna ao processar este comando. Tente novamente mais tarde.',
      });

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
