import { Message, EmbedBuilder } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { KuruttinaClient } from '../../../types/kuruttina-client';

export const event = {
  name: 'messageCreate',
  once: false,
  async execute(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const prefix = process.env.DEFAULT_PREFIX || DEFAULT_BOT_CONFIG.DEFAULT_PREFIX;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandTrigger = args.shift()?.toLowerCase();

    if (!commandTrigger) return;

    const client = message.client as KuruttinaClient;

    // Find command by Slash name or Prefix Aliases
    const command = client.commands.find((cmd) => {
      if (cmd.data.name === commandTrigger) return true;
      if (cmd.prefixAliases && cmd.prefixAliases.includes(commandTrigger)) return true;
      return false;
    });

    if (!command) return;

    const ctx = new CommandContext(message, args);

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error(
        `❌ [Kuruttina] Erro ao executar o comando por Prefixo ${prefix}${commandTrigger}:`,
        error
      );

      const errorEmbed = new EmbedBuilder()
        .setColor(STATUS_COLORS.ERROR.number)
        .setTitle('❌ Ocorreu um Erro')
        .setDescription(
          'Ocorreu uma falha interna ao processar este comando. Tente novamente mais tarde.'
        );

      await ctx.reply({ embeds: [errorEmbed] });
    }
  },
};
