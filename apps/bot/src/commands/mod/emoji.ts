import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';
import { addEmojiAddOptions, createEmojiAddExecutor } from '#bot/infrastructure/discord/emojis/emojiAdd.js';
import { createEmojiInfoExecutor } from '#bot/infrastructure/discord/emojis/emojiInfo.js';

const { ViewChannel, ManageGuildExpressions, CreateGuildExpressions, EmbedLinks } = PermissionFlagsBits;

/**
 * Consulta e adiciona emojis no servidor onde o comando foi executado.
 *
 * A raiz exige canal de texto, visualização e envio. A rota `add` soma a
 * permissão de gerenciar emojis do membro e a de criar emojis do bot. A rota
 * `info` soma somente a permissão de inserir links do bot.
 */
export const command = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Consulta ou adiciona emojis neste servidor')
    .addSubcommand((subcommand) =>
      addEmojiAddOptions(
        subcommand
          .setName('add')
          .setDescription('Adiciona um emoji a este servidor, a partir de uma imagem ou de um emoji de outro servidor'),
      ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('Mostra a identidade e a imagem de um emoji personalizado')
        .addStringOption((option) =>
          option
            .setName('emoji')
            .setDescription('Marcação completa, como <:nome:id> ou <a:nome:id>')
            .setRequired(true),
        ),
    ),
  access: {
    kind: 'guild',
    userPermissions: [],
    botPermissions: [ViewChannel],
    requireChannelSend: true,
    messages: {
      guildOnly: 'Use um canal de texto de servidor para gerenciar emojis.',
    },
  },
  help: { topic: 'mod' },
  scope: 'global' as const,
  routes: [
    {
      path: ['add'],
      aliases: ['emoji-add'],
      examples: [
        { slash: '/emoji add emoji:<:nome:123456789012345678>', prefix: 'k!emoji-add <:nome:123456789012345678>' },
        { slash: '/emoji add nome:meu_emoji arquivo:imagem.png', prefix: 'k!emoji-add meu_emoji' },
      ],
      access: {
        userPermissions: [ManageGuildExpressions],
        botPermissions: [CreateGuildExpressions],
        messages: {
          guildOnly: 'Use um canal de texto de servidor para adicionar emojis.',
          userMissing: 'Você precisa da permissão **{permissions}** para adicionar emojis.',
          botMissing: 'Preciso destas permissões para adicionar o emoji: **{permissions}**.',
        },
      },
      execute: createEmojiAddExecutor('guild'),
    },
    {
      path: ['info'],
      aliases: ['emoji-info'],
      examples: [
        { slash: '/emoji info emoji:<:nome:123456789012345678>', prefix: 'k!emoji-info <:nome:123456789012345678>' },
      ],
      access: {
        userPermissions: [],
        botPermissions: [EmbedLinks],
        messages: {
          guildOnly: 'Use um canal de texto de servidor para consultar emojis.',
        },
      },
      execute: createEmojiInfoExecutor(),
    },
  ],
} satisfies ChatInputCommand;
