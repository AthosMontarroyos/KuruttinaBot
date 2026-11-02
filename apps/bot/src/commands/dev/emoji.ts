import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';
import {
  addProductionEmojiOptions,
  createProductionEmojiExecutor,
} from '#bot/infrastructure/discord/emojis/productionEmojiAdd.js';

/**
 * Pede um Application Emoji do bot de produção pelo workflow `emoji-prod.yml`.
 * O módulo fica em `commands/dev/`: o loader exige `scope: 'dev-guild'` e a
 * política `staff`, então o comando é publicado somente nas guildas de
 * desenvolvimento cadastradas. Ele não recebe token e não cria o emoji.
 * Sem `GITHUB_WORKFLOW_TOKEN`, só orienta o workflow manual.
 * O nome é opcional: sem ele, a marcação ou o arquivo dão o nome, e um
 * resultado inválido é recusado antes do disparo.
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
          addProductionEmojiOptions(
            subcommand
              .setName('add')
              .setDescription('Pede um Application Emoji no bot de produção'),
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
      guildOnly: 'Use um canal de texto de servidor para os comandos de equipe.',
      botMissing: 'Preciso destas permissões para executar este comando: **{permissions}**.',
    },
  },
  help: { topic: 'dev' },
  scope: 'dev-guild' as const,
  routes: [
    {
      path: ['emoji', 'add'],
      aliases: ['dev-emoji-add'],
      examples: [
        {
          slash: '/dev emoji add origem:<:nome:123456789012345678>',
          prefix: 'k!dev-emoji-add <:nome:123456789012345678>',
        },
        {
          slash: '/dev emoji add nome:meu_emoji origem:123456789012345678',
          prefix: 'k!dev-emoji-add meu_emoji 123456789012345678',
        },
        {
          slash: '/dev emoji add arquivo:party-cat.png',
          prefix: 'k!dev-emoji-add https://cdn.discordapp.com/attachments/1/2/party-cat.png',
        },
      ],
      execute: createProductionEmojiExecutor(),
    },
  ],
} satisfies ChatInputCommand;
