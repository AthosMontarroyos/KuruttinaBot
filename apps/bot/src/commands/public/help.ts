import { SlashCommandBuilder } from 'discord.js';
import { buildHelpReply } from '#bot/command-system/helpReply.js';
import type { ChatInputCommand, CommandContext } from '#bot/command-system/types.js';

/** Query do `/help`: a opção `comando` do slash ou o texto após o prefixo. Valores não string são ignorados. */
function queryFrom(context: CommandContext): string | undefined {
  if (context.options) {
    const value = context.options.find((option) => option.name === 'comando')?.value;
    return typeof value === 'string' ? value : undefined;
  }
  return context.rawArgs;
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lista os comandos e mostra como usar cada um')
    .addStringOption((option) => option
      .setName('comando')
      .setDescription('Comando para ver em detalhes, como ban ou emoji add')
      .setRequired(false)
      .setMaxLength(60)),
  access: { kind: 'public' },
  help: {
    topic: 'utility',
    examples: [
      { slash: '/help', prefix: 'k!help' },
      { slash: '/help comando:ban', prefix: 'k!help ban' },
    ],
  },
  scope: 'global',
  async execute(context: CommandContext): Promise<void> {
    await context.acknowledge();
    await context.reply(buildHelpReply(context.commandCatalog ?? [], queryFrom(context), {
      book: await context.emoji('book'),
      search: await context.emoji('search'),
    }, context.userId));
  },
} satisfies ChatInputCommand;
