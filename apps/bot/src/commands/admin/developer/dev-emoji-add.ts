import {
  SlashCommandBuilder,
  APIEmbed,
} from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG, EMOJIS } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-add')
    .setDescription('[Dev Only] Importa um emoji para o Discord Developer Portal da Kuruttina')
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome de registro do emoji no Developer Portal')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('emoji')
        .setDescription('Emoji customizado do Discord (ex: <:nome:id> ou <a:nome:id>)')
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('arquivo')
        .setDescription('Arquivo de imagem ou GIF para criar o emoji')
        .setRequired(false)
    ),
  prefixAliases: ['dev-emoji-add', 'devemojiadd', 'addappemoji'],
  category: 'admin',
  subCategory: 'developer',
  guide: {
    syntax: 'k!dev-emoji-add <nome> [emoji_customizado|arquivo]',
    examples: [
      '/dev-emoji-add nome:ping emoji:<:ping:1234567890>',
      'k!dev-emoji-add ping <:ping:1234567890>',
    ],
    detailedDescription:
      'Comando exclusivo de desenvolvedor para fazer o upload de novos Emojis de Aplicação diretamente no Discord Developer Portal da Kuruttina.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const devGuildId = process.env.DEV_GUILD_ID;
    const creatorId = process.env.CREATOR_ACCOUNT_ID;
    const devId = process.env.DEV_ACCOUNT_ID;

    // 1. Verify Dev Guild Only Restriction
    if (!ctx.guild || (devGuildId && ctx.guild.id !== devGuildId)) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Acesso Negado`,
        description:
          'Este comando só pode ser executado dentro do servidor de desenvolvimento oficial da Kuruttina.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // 2. Verify Creator or Dev Account Only Restriction
    const userId = ctx.user.id;
    const isAuthorized =
      (creatorId && userId === creatorId) || (devId && userId === devId);

    if (!isAuthorized) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Permissão Insuficiente`,
        description:
          'Apenas os desenvolvedores autorizados ou o criador da Kuruttina podem executar este comando.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    await ctx.deferReply(true);

    // Get parameters
    let emojiName = '';
    let rawEmojiInput: string | undefined;
    let fileAttachment: any | undefined;

    if (ctx.isSlash && ctx.slashInteraction) {
      emojiName = ctx.slashInteraction.options.getString('nome', true).trim();
      rawEmojiInput = ctx.slashInteraction.options.getString('emoji') || undefined;
      fileAttachment = ctx.slashInteraction.options.getAttachment('arquivo') || undefined;
    } else {
      emojiName = ctx.args[0];
      rawEmojiInput = ctx.args[1];
      if (ctx.message && ctx.message.attachments.size > 0) {
        fileAttachment = ctx.message.attachments.first();
      }
    }

    if (!emojiName) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.WARNING} Parâmetro Ausente`,
        description:
          'Forneça o nome do emoji a ser registrado. Ex: `/dev-emoji-add nome:ping`',
        color: STATUS_COLORS.WARNING.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Extract image URL
    let imageUrl: string | null = null;

    if (fileAttachment) {
      imageUrl = fileAttachment.url;
    } else if (rawEmojiInput) {
      // Regex for custom Discord Emoji syntax <:name:id> or <a:name:id>
      const customEmojiMatch = rawEmojiInput.match(/<(a)?:(\w+):(\d+)>/);
      if (customEmojiMatch) {
        const isAnimated = Boolean(customEmojiMatch[1]);
        const emojiId = customEmojiMatch[3];
        const ext = isAnimated ? 'gif' : 'png';
        imageUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;
      } else if (rawEmojiInput.startsWith('http://') || rawEmojiInput.startsWith('https://')) {
        imageUrl = rawEmojiInput;
      }
    }

    if (!imageUrl) {
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Imagem Não Encontrada`,
        description:
          'Forneça um emoji customizado do Discord (ex: `<:nome:123>`) ou envie um arquivo de imagem.',
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    try {
      const app = ctx.client.application;
      if (!app) {
        throw new Error('A aplicação do Discord não está acessível no cliente.');
      }

      // Create Application Emoji directly in Discord Developer Portal!
      const createdAppEmoji = await app.emojis.create({
        attachment: imageUrl,
        name: emojiName,
      });

      if (!createdAppEmoji) {
        throw new Error('Falha ao criar o emoji de aplicação no Developer Portal.');
      }

      const successEmbed: APIEmbed = {
        title: `${EMOJIS.SUCCESS} Application Emoji Criado!`,
        description: `O emoji **${createdAppEmoji.name}** foi importado e registrado com sucesso no **Discord Developer Portal**!`,
        color: STATUS_COLORS.SUCCESS.number,
        fields: [
          {
            name: '✨ Emoji Renderizado',
            value: `${createdAppEmoji.toString()} (\`${createdAppEmoji.toString()}\`)`,
            inline: true,
          },
          {
            name: '🆔 ID do Emoji',
            value: `\`${createdAppEmoji.id}\``,
            inline: true,
          },
          {
            name: '🏷️ Nome Registrado',
            value: `\`${createdAppEmoji.name}\``,
            inline: true,
          },
        ],
        footer: {
          text: DEFAULT_BOT_CONFIG.BOT_NAME,
          icon_url: ctx.client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      await ctx.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ Erro ao registrar Application Emoji no Developer Portal:', error);

      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Falha no Registro`,
        description: `Ocorreu uma falha ao importar o emoji para o Developer Portal: \`${
          error.message || error
        }\``,
        color: STATUS_COLORS.ERROR.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
