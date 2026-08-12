import path from 'path';
import { SlashCommandBuilder, APIEmbed, Attachment, Events } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG, sanitizeEmojiName } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import {
  PermissionGuard,
  getEmojis,
  getEmojiAppConfigs,
  withAppClient,
  EmojiAppConfig,
} from '../../../utils';

/**
 * Downloads image buffer from HTTP/CDN URL with candidate extension fallback
 * (.gif -> .png -> .webp) to prevent Discord CDN HTML/JSON error text from being sent to Discord API.
 */
async function fetchValidImageDataUri(sourceUrl: string): Promise<string | null> {
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

/**
 * Extracts emoji name automatically from custom emoji tag (<a:name:id>), URL, attachment filename, or explicit string.
 * Uses sanitizeEmojiName to automatically convert hyphens (-) to underscores (_).
 */
function extractEmojiName(
  explicitName: string | null,
  rawEmojiInput: string | null,
  attachment: Attachment | null
): string | null {
  let candidate: string | null = null;

  if (explicitName && explicitName.trim().length > 0) {
    candidate = explicitName;
  } else if (rawEmojiInput) {
    // Discord custom emoji tag <a:shooting-star:123456789> or <:verified_icon:987654321>
    const match = rawEmojiInput.match(/<a?:([a-zA-Z0-9_-]+):\d+>/);
    if (match && match[1]) {
      candidate = match[1];
    } else {
      // Direct Image URL: https://cdn.discordapp.com/emojis/.../pink-butterfly-divider.png
      try {
        const urlObj = new URL(rawEmojiInput);
        const basename = path.basename(urlObj.pathname);
        const ext = path.extname(basename);
        const nameWithoutExt = basename.substring(0, basename.length - ext.length);
        if (nameWithoutExt && !/^\d+$/.test(nameWithoutExt)) {
          candidate = nameWithoutExt;
        }
      } catch {
        // Not a URL
      }
    }
  } else if (attachment && attachment.name) {
    const ext = path.extname(attachment.name);
    const nameWithoutExt = attachment.name.substring(0, attachment.name.length - ext.length);
    if (nameWithoutExt) {
      candidate = nameWithoutExt;
    }
  }

  return candidate ? sanitizeEmojiName(candidate) : null;
}

/**
 * Smart Prefix Argument Parser:
 * Token order: k!dev-emoji-add <emoji_ou_url> [app_id] [nome]
 */
function parsePrefixEmojiAddArgs(args: string[], attachment: Attachment | null) {
  let explicitName: string | null = null;
  let rawEmojiInput: string | null = null;
  let targetAppIndex: number | null = null;

  for (let i = 0; i < args.length; i++) {
    const token = args[i].trim();
    if (!token) continue;

    // Flag syntax: app:2 or --app=2
    const flagMatch = token.match(/^(?:--)?app[:=]?(\d+)$/i);
    if (flagMatch) {
      targetAppIndex = parseInt(flagMatch[1], 10);
      continue;
    }

    const nameFlagMatch = token.match(/^(?:--)?name[:=]?(.+)$/i);
    if (nameFlagMatch) {
      explicitName = nameFlagMatch[1];
      continue;
    }

    // Custom emoji tag (<a:name:id> or <:name:id>) or HTTP URL
    if (token.startsWith('<a:') || token.startsWith('<:') || token.startsWith('http://') || token.startsWith('https://')) {
      if (!rawEmojiInput) {
        rawEmojiInput = token;
      }
      continue;
    }

    // Standalone number (App ID like "2" or "#2")
    const numberMatch = token.match(/^#?(\d+)$/);
    if (numberMatch) {
      const val = parseInt(numberMatch[1], 10);
      if (!targetAppIndex && (attachment || rawEmojiInput || explicitName || i > 0)) {
        targetAppIndex = val;
        continue;
      }
    }

    // Otherwise token is explicit name override!
    if (!explicitName && !/^\d+$/.test(token)) {
      explicitName = token;
    }
  }

  return { explicitName, rawEmojiInput, targetAppIndex };
}

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-add')
    .setDescription('[Dev Only] Importa e cria um Application Emoji em um dos apps vinculados')
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
    )
    .addIntegerOption((option) =>
      option
        .setName('app')
        .setDescription('ID da App Vault de destino (ex: 1 para Kuruttina, 2 para Emojis)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome customizado do emoji (opcional - extraído automaticamente se omitido)')
        .setRequired(false)
    ),

  prefixAliases: ['dev-emoji-add', 'add-emoji', 'import-emoji'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-add <emoji_ou_url> [app_id] [nome] ou /dev-emoji-add emoji:<emoji> [app:<id>] [nome:<nome>]',
    examples: [
      'k!dev-emoji-add <a:kiss:1492107771510919300> 2',
      'k!dev-emoji-add <a:kiss:1492107771510919300> 2 meu_nome_customizado',
      '/dev-emoji-add emoji:<a:shooting:1492107771510919300> app:2',
    ],
    detailedDescription:
      'Baixa a imagem de um emoji customizado ou URL e cadastra diretamente no Discord Developer Portal de uma das aplicações vinculadas. O nome é opcional e extraído automaticamente.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    const e = await getEmojis(ctx.client);

    let explicitName: string | null = null;
    let rawEmojiInput: string | null = null;
    let fileAttachment: Attachment | null = null;
    let targetAppIndex: number | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      rawEmojiInput = ctx.slashInteraction.options.getString('emoji');
      fileAttachment = ctx.slashInteraction.options.getAttachment('arquivo');
      targetAppIndex = ctx.slashInteraction.options.getInteger('app');
      explicitName = ctx.slashInteraction.options.getString('nome');
    } else {
      fileAttachment = ctx.message?.attachments.first() || null;
      const parsed = parsePrefixEmojiAddArgs(ctx.args, fileAttachment);
      explicitName = parsed.explicitName;
      rawEmojiInput = parsed.rawEmojiInput;
      targetAppIndex = parsed.targetAppIndex;
    }

    const emojiName = extractEmojiName(explicitName, rawEmojiInput, fileAttachment);

    if (!emojiName) {
      const errorEmbed: APIEmbed = {
        title: `${e.WARNING} Nome do Emoji Não Identificado`,
        description:
          'Não foi possível extrair o nome do emoji automaticamente. Forneça o nome no final: `k!dev-emoji-add <emoji> 2 meu_nome` ou `/dev-emoji-add emoji:<emoji> app:2 nome:meu_nome`',
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
        const errorEmbed: APIEmbed = {
          title: `${e.ERROR} Imagem Não Encontrada`,
          description:
            'Forneça um emoji customizado do Discord, uma URL de imagem válida ou um arquivo anexado.',
          color: EMBED_COLORS.BLACK.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      const allApps = await getEmojiAppConfigs();
      if (allApps.length === 0) {
        const errorEmbed: APIEmbed = {
          title: `${e.ERROR} Nenhuma App Vault Configurada`,
          description: 'Nenhum token de aplicação foi encontrado na configuração `.env`.',
          color: EMBED_COLORS.BLACK.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      let selectedApp: EmojiAppConfig | null = null;
      if (targetAppIndex) {
        selectedApp = allApps.find((a: EmojiAppConfig) => a.id === targetAppIndex) || null;
        if (!selectedApp) {
          const errorEmbed: APIEmbed = {
            title: `${e.WARNING} App Não Encontrada`,
            description: `App ID **#${targetAppIndex}** não existe. Aplicações disponíveis: ${allApps
              .map((a: EmojiAppConfig) => `\`#${a.id}: ${a.name}\``)
              .join(', ')}`,
            color: EMBED_COLORS.BLACK.number,
          };
          await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }
      } else {
        selectedApp = allApps[0];
      }

      await withAppClient(selectedApp.token, async (uploadClient: any) => {
        if (!uploadClient.application) {
          throw new Error('client.application não está acessível na aplicação selecionada.');
        }

        const existingEmojis = await uploadClient.application.emojis.fetch();
        const existingByName = existingEmojis.find(
          (emojiItem: any) => emojiItem.name?.toLowerCase() === emojiName.toLowerCase()
        );

        if (existingByName) {
          const warningEmbed: APIEmbed = {
            title: `${e.WARNING} Emoji Já Existente na Vault`,
            description: `O emoji **${existingByName.name}** (\`${existingByName.name}\`) já existe no **Discord Developer Portal** da App Vault **#${selectedApp!.id} (${selectedApp!.name})**!`,
            color: EMBED_COLORS.BLACK.number,
            fields: [
              {
                name: `${e.STAR} Emoji Existente`,
                value: `${existingByName.toString()}`,
                inline: true,
              },
              {
                name: `${e.LABEL} Marcação Copiável`,
                value: `\`${existingByName.toString()}\``,
                inline: true,
              },
              {
                name: `${e.ID} ID do Emoji`,
                value: `\`${existingByName.id}\``,
                inline: true,
              },
              {
                name: `${e.IDEA} Dica de Nome`,
                value: `Para salvar outro emoji parecido nesta mesma Vault, especifique um nome diferente no final: \`k!dev-emoji-add <emoji> ${selectedApp!.id} ${emojiName}_2\``,
                inline: false,
              },
            ],
            footer: {
              text: DEFAULT_BOT_CONFIG.BOT_NAME,
              icon_url: ctx.client.user?.displayAvatarURL(),
            },
            timestamp: new Date().toISOString(),
          };

          await ctx.reply({ embeds: [warningEmbed], ephemeral: true });
          return;
        }

        const createdAppEmoji = await uploadClient.application.emojis.create({
          attachment: dataUri!,
          name: emojiName,
        });

        const successEmbed: APIEmbed = {
          title: `${e.SUCCESS} Application Emoji Criado!`,
          description: `O emoji **${createdAppEmoji.name}** foi importado com sucesso na App Vault **#${selectedApp!.id} (${selectedApp!.name})**!`,
          color: EMBED_COLORS.BLACK.number,
          fields: [
            {
              name: `${e.RENDER} Emoji Renderizado`,
              value: `${createdAppEmoji.toString()}`,
              inline: true,
            },
            {
              name: `${e.LABEL} Marcação / Formato Copiável`,
              value: `\`${createdAppEmoji.toString()}\``,
              inline: true,
            },
            {
              name: `${e.ID} ID do Emoji`,
              value: `\`${createdAppEmoji.id}\``,
              inline: true,
            },
            {
              name: `${e.VAULT} App Vault Destino`,
              value: `\`#${selectedApp!.id}: ${selectedApp!.name}\` (\`${selectedApp!.sanitizedFolderName}\`)`,
              inline: false,
            },
          ],
          footer: {
            text: DEFAULT_BOT_CONFIG.BOT_NAME,
            icon_url: ctx.client.user?.displayAvatarURL(),
          },
          timestamp: new Date().toISOString(),
        };

        await ctx.reply({ embeds: [successEmbed], ephemeral: true });
      });
    } catch (error: any) {
      console.error('❌ Erro ao registrar Application Emoji no Developer Portal:', error);

      const errorEmbed: APIEmbed = {
        title: `${e.ERROR} Falha no Registro`,
        description: `Ocorreu uma falha ao importar o emoji para o Developer Portal: \`${
          error.message || error
        }\``,
        color: EMBED_COLORS.BLACK.number,
      };

      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
