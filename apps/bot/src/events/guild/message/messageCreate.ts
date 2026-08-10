import { Message, Events, APIEmbed } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { KuruttinaClient } from '../../../types/kuruttina-client';

export const event = {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const prefix = process.env.DEFAULT_PREFIX || DEFAULT_BOT_CONFIG.DEFAULT_PREFIX;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandTrigger = args.shift()?.toLowerCase();

    if (!commandTrigger) return;

    const client = message.client as KuruttinaClient;

    // Check if the command trigger is a dynamic dice expression (e.g. k!1d20, k!2d6, k!5d10, k!d20)
    const isDicePattern = /^(\d*)d(\d+)$/i.test(commandTrigger);

    // Find command by Slash name, Prefix Aliases, or dynamic dice pattern
    const command = client.commands.find((cmd) => {
      if (cmd.data.name === commandTrigger) return true;
      if (cmd.prefixAliases && cmd.prefixAliases.includes(commandTrigger)) return true;
      if (isDicePattern && (cmd.data.name === 'roll' || cmd.prefixAliases?.includes('roll'))) return true;
      return false;
    });

    if (!command) return;

    // Pass the command trigger as first argument if it's a dynamic dice pattern
    const commandArgs = isDicePattern ? [commandTrigger, ...args] : args;

    const ctx = new CommandContext(message, commandArgs);

    try {
      await command.execute(ctx);
    } catch (error) {
      console.error(
        `❌ [Kuruttina] Erro ao executar o comando por Prefixo ${prefix}${commandTrigger}:`,
        error
      );

      const errorEmbed: APIEmbed = {
        title: '❌ Ocorreu um Erro',
        description: 'Ocorreu uma falha interna ao processar este comando. Tente novamente mais tarde.',
        color: STATUS_COLORS.ERROR.number,
      };

      await ctx.reply({ embeds: [errorEmbed] });
    }
  },
};
