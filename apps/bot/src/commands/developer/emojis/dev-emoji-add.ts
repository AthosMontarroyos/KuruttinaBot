import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { getEmoji } from '../../../utils/emoji-resolver';

/**
 * Downloads image from URL or Discord Emoji ID with fallback format support (.gif -> .png -> .webp).
 * Returns a valid Data URI string (data:image/png;base64,...) or throws a descriptive error.
 */
async function fetchValidImageDataUri(rawInput: string): Promise<string> {
  const customEmojiMatch = rawInput.match(/<(a)?:(\w+):(\d+)>/);
  const candidateUrls: string[] = [];

  if (customEmojiMatch) {
    const isAnimated = Boolean(customEmojiMatch[1]);
    const emojiId = customEmojiMatch[3];
    if (isAnimated) {
      candidateUrls.push(`https://cdn.discordapp.com/emojis/${emojiId}.gif?size=128&quality=lossless`);
      candidateUrls.push(`https://cdn.discordapp.com/emojis/${emojiId}.png?size=128&quality=lossless`);
    } else {
      candidateUrls.push(`https://cdn.discordapp.com/emojis/${emojiId}.png?size=128&quality=lossless`);
      candidateUrls.push(`https://cdn.discordapp.com/emojis/${emojiId}.gif?size=128&quality=lossless`);
    }
  } else if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
    candidateUrls.push(rawInput);
  } else {
    throw new Error('Formato de emoji ou URL de imagem inválido.');
  }

  let lastError: Error | null = null;

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Content-Type inválido: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify header is not JSON or HTML error response
      const snippet = buffer.toString('utf8', 0, 50);
      if (snippet.trim().startsWith('{') || snippet.trim().startsWith('<html')) {
        throw new Error('Servidor retornou um erro em JSON/HTML em vez de imagem.');
      }

      const base64Data = buffer.toString('base64');
      const cleanMime = contentType.split(';')[0].trim();
      return `data:${cleanMime};base64,${base64Data}`;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(
    lastError?.message ||
      'Não foi possível baixar a imagem. Verifique se o emoji existe no Discord CDN.'
  );
}

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
        .setDescription('Emoji customizado do Discord (ex: <:nome:id> ou <a:nome:id>) ou URL')
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('arquivo')
        .setDescription('Arquivo de imagem ou GIF para criar o emoji')
        .setRequired(false)
    ),
  prefixAliases: ['dev-emoji-add', 'devemojiadd', 'addappemoji'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-add <nome> [emoji_customizado|arquivo|URL]',
    examples: [
      '/dev-emoji-add nome:shooting emoji:<a:shooting:1492107771510919300>',
      'k!dev-emoji-add shooting <a:shooting:1492107771510919300>',
    ],
    detailedDescription:
      'Comando exclusivo de desenvolvedor para fazer o upload de novos Emojis de Aplicação diretamente no Discord Developer Portal da Kuruttina com validação de buffer contra erros de asset inválido.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    // 1. Enforce Dev Only Permission & Dev Guild Security Guard
    const isAuthorized = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAuthorized) return;

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
      const warningEmoji = await getEmoji(ctx.client, 'WARNING');
      const errorEmbed: APIEmbed = {
        title: `${warningEmoji} Parâmetro Ausente`,
        description: 'Forneça o nome do emoji a ser registrado. Ex: `/dev-emoji-add nome:shooting`',
        color: STATUS_COLORS.WARNING.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    try {
      let dataUri: string | null = null;

      if (fileAttachment) {
        dataUri = await fetchValidImageDataUri(fileAttachment.url);
      } else if (rawEmojiInput) {
        dataUri = await fetchValidImageDataUri(rawEmojiInput);
      }

      if (!dataUri) {
        const errorEmoji = await getEmoji(ctx.client, 'ERROR');
        const errorEmbed: APIEmbed = {
          title: `${errorEmoji} Imagem Não Encontrada`,
          description:
            'Forneça um emoji customizado do Discord (ex: `<a:shooting:1492107771510919300>`), uma URL de imagem válida ou um arquivo anexado.',
          color: STATUS_COLORS.ERROR.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      const app = ctx.client.application;
      if (!app) {
        throw new Error('A aplicação do Discord não está acessível no cliente.');
      }

      // Create Application Emoji directly in Discord Developer Portal!
      const createdAppEmoji = await app.emojis.create({
        attachment: dataUri,
        name: emojiName,
      });

      if (!createdAppEmoji) {
        throw new Error('Falha ao criar o emoji de aplicação no Developer Portal.');
      }

      const successEmoji = await getEmoji(ctx.client, 'SUCCESS');
      const successEmbed: APIEmbed = {
        title: `${successEmoji} Application Emoji Criado!`,
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

      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Falha no Registro`,
        description: `Ocorreu uma falha ao importar o emoji para o Developer Portal: \`${
          error.message || error
        }\``,
        color: STATUS_COLORS.ERROR.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
