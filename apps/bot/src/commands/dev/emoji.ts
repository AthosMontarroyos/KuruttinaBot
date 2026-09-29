import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addEmojiAddOptions, createEmojiAddExecutor } from '#bot/commands/emojiAdd.js';
import type { ChatInputCommand } from '#bot/commands/types.js';

/**
 * Adiciona um emoji aos Application Emojis do bot de produção.
 *
 * O módulo fica em `commands/dev/`: o loader exige `scope: 'dev-guild'` e a
 * política `staff` para qualquer arquivo dessa pasta, então o comando é
 * publicado somente na guilda de desenvolvimento cadastrada e nunca no
 * payload global. A publicação restrita não substitui a autorização: nos dois
 * transports a política `staff` exige um usuário ativo como Dev ou Creator.
 * O destino de produção é escolhido na composição do processo; este módulo
 * não recebe tokens nem o objeto de credenciais.
 */
export const command = {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('Comandos exclusivos da equipe de desenvolvimento')
    .addSubcommandGroup((group) =>
      group
        .setName('emoji')
        .setDescription('Emojis do bot')
        .addSubcommand((subcommand) =>
          addEmojiAddOptions(
            subcommand
              .setName('add')
              .setDescription('Adiciona um emoji aos Application Emojis do bot de produção'),
          ),
        ),
    ),
  access: {
    kind: 'staff',
    minimumRole: 'dev',
    userPermissions: [],
    botPermissions: [PermissionFlagsBits.ViewChannel],
    requireChannelSend: true,
    messages: {
      guildOnly: 'Vamos usar os comandos de equipe em um canal de texto de servidor!',
      botMissing: 'Preciso destas permissões para executar este comando: **{permissions}**.',
    },
  },
  scope: 'dev-guild' as const,
  routes: [
    { path: ['emoji', 'add'], aliases: ['dev-emoji-add'], execute: createEmojiAddExecutor('application') },
  ],
} satisfies ChatInputCommand;
