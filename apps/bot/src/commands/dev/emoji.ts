import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type { ChatInputCommand, CommandContext } from '#bot/command-system/types.js';

const productionEmojiRedirect =
  'Eu não adiciono Application Emojis ao bot de produção por aqui. Grave a imagem no repositório e use o workflow **Adicionar emoji de produção** no GitHub. A criação espera aprovação.';

/**
 * Orienta a equipe a criar Application Emojis do bot de produção pelo workflow
 * manual. O módulo fica em `commands/dev/`: o loader exige `scope: 'dev-guild'`
 * e a política `staff`, então o comando é publicado somente na guilda de
 * desenvolvimento cadastrada. Ele não recebe token nem cria o emoji.
 */
async function explainProductionEmoji(context: CommandContext): Promise<void> {
  await context.acknowledge();
  await context.reply(withEmojis(await context.emoji('book'), productionEmojiRedirect));
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('Comandos exclusivos da equipe de desenvolvimento')
    .addSubcommandGroup((group) =>
      group
        .setName('emoji')
        .setDescription('Emojis do bot')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setDescription('Informa como adicionar um Application Emoji ao bot de produção'),
        ),
    ),
  access: {
    kind: 'staff',
    minimumRole: 'dev',
    userPermissions: [],
    botPermissions: [PermissionFlagsBits.ViewChannel],
    requireChannelSend: true,
    messages: {
      guildOnly: 'Use um canal de texto de servidor para os comandos de equipe.',
      botMissing: 'Preciso destas permissões para executar este comando: **{permissions}**.',
    },
  },
  scope: 'dev-guild' as const,
  routes: [
    { path: ['emoji', 'add'], aliases: ['dev-emoji-add'], execute: explainProductionEmoji },
  ],
} satisfies ChatInputCommand;
