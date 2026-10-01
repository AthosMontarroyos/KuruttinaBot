import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { addEmojiAddOptions, createEmojiAddExecutor } from '#bot/commands/emojiAdd.js';
import type { ChatInputCommand } from '#bot/commands/types.js';

/**
 * Adiciona um emoji ao servidor onde o comando foi executado.
 *
 * Aberto a qualquer servidor: a política `guild` exige do membro a permissão de
 * gerenciar emojis e do bot a de criar emojis, ambas conferidas no canal antes
 * de qualquer download.
 */
export const command = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Gerencia os emojis deste servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .addSubcommand((subcommand) =>
      addEmojiAddOptions(
        subcommand
          .setName('add')
          .setDescription('Adiciona um emoji a este servidor, a partir de uma imagem ou de um emoji de outro servidor'),
      ),
    ),
  access: {
    kind: 'guild',
    userPermissions: [PermissionFlagsBits.ManageGuildExpressions],
    botPermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateGuildExpressions],
    requireChannelSend: true,
    messages: {
      guildOnly: 'Use um canal de texto de servidor para adicionar emojis.',
      userMissing: 'Você precisa da permissão **{permissions}** para adicionar emojis.',
      botMissing: 'Preciso destas permissões para adicionar o emoji: **{permissions}**.',
    },
  },
  scope: 'global' as const,
  routes: [
    { path: ['add'], aliases: ['emoji-add'], execute: createEmojiAddExecutor('guild') },
  ],
} satisfies ChatInputCommand;
