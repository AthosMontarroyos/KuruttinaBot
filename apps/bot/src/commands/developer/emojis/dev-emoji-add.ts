import { SlashCommandBuilder, APIEmbed, Attachment } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { getEmoji } from '../../../utils/emoji-resolver';

/**
 * Downloads image buffer from HTTP/CDN URL with candidate extension fallback
 * (.gif -> .png -> .webp) to prevent Discord CDN HTML/JSON error text from being sent to Discord API.
 */
async function fetchValidImageDataUri(sourceUrl: string): Promise<string | null> {
  // If user passed formatted custom emoji string: e.g. <a:name:id> or <:name:id>
  const customEmojiMatch = sourceUrl.match(/<a?:(\w+):(\d+)>/);
  if (customEmojiMatch) {
    const isAnimated = sourceUrl.startsWith('<a:');
    const emojiId = customEmojiMatch[2];
    const candidateExts = isAnimated ? ['gif', 'png', 'webp'] : ['png', 'gif', 'webp'];

    for (const ext of candidateExts) {
      const cdnUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=256&quality=lossless`;
      try {
        const res = await fetch(cdnUrl);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.startsWith('image/')) {
            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return `data:${contentType};base64,${base64}`;
          }
        }
      } catch {
        // Try next candidate extension
      }
    }
    return null;
  }

  // Normal Direct Image URL
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) return null;

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-add')
    .setDescription('[Dev Only] Importa e cria um Application Emoji diretamente no Developer Portal da Kuruttina')
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome do emoji no Developer Portal (ex: shooting, star, verified)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('emoji')
        .setDescription('Emoji customizado do Discord (ex: <a:shooting:1492107771510919300>) ou URL da imagem')
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('arquivo')
        .setDescription('Arquivo de imagem (PNG, GIF, WEBP) para enviar')
        .setRequired(false)
    ),

  prefixAliases: ['dev-emoji-add', 'add-emoji', 'import-emoji'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-add <nome> <emoji_ou_url> ou /dev-emoji-add nome:<nome> [emoji:<url_ou_emoji>]',
    examples: [
      '/dev-emoji-add nome:shooting emoji:<a:shooting:1492107771510919300>',
      'k!dev-emoji-add verified https://cdn.discordapp.com/...',
    ],
    detailedDescription:
      'Baixa a imagem de um emoji customizado ou URL e cadastra diretamente no Discord Developer Portal da Kuruttina como um Application Emoji oficial.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    // Restrito a Desenvolvedores / Servidor Dev
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    let emojiName = '';
    let rawEmojiInput: string | null = null;
    let fileAttachment: Attachment | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      emojiName = ctx.slashInteraction.options.getString('nome', true).trim().toLowerCase();
      rawEmojiInput = ctx.slashInteraction.options.getString('emoji');
      fileAttachment = ctx.slashInteraction.options.getAttachment('arquivo');
    } else {
      // Prefix Parsing: k!dev-emoji-add <nome> <emoji_ou_url>
      emojiName = ctx.args[0]?.trim().toLowerCase();
      rawEmojiInput = ctx.args[1] || null;
      fileAttachment = ctx.message?.attachments.first() || null;
    }

    if (!emojiName) {
      const warningEmoji = await getEmoji(ctx.client, 'WARNING');
      const errorEmbed: APIEmbed = {
        title: `${warningEmoji} Parâmetro Ausente`,
        description: 'Forneça o nome do emoji a ser registrado. Ex: `/dev-emoji-add nome:shooting`',
        color: EMBED_COLORS.BLACK.number,
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
          color: EMBED_COLORS.BLACK.number,
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
        color: EMBED_COLORS.BLACK.number,
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
        color: EMBED_COLORS.BLACK.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
