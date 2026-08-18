import path from 'path';
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Attachment,
} from 'discord.js';
import { DEFAULT_BOT_CONFIG, sanitizeEmojiName, CooldownManager } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import {
  getEmojis,
  createKuruttinaEmbed,
  sendErrorReply,
  fetchDiscordEmojiDataUri,
} from '../../../../utils';

// Cooldown: 5s per user
const emojiAddCooldowns = new CooldownManager(5);

/**
 * Extracts emoji name automatically from custom emoji tag (<a:name:id>), URL, attachment filename, or explicit string.
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
    const match = rawEmojiInput.match(/<a?:([a-zA-Z0-9_-]+):\d+>/);
    if (match && match[1]) {
      candidate = match[1];
    } else {
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

  if (!candidate) return null;
  const sanitized = sanitizeEmojiName(candidate);
  if (sanitized.length < 2) return null;
  return sanitized.substring(0, 32);
}

/**
 * Parse prefix args: k!emojiadd <emoji_ou_url> [nome]
 */
function parsePrefixEmojiAddArgs(args: string[], attachment: Attachment | null) {
  let explicitName: string | null = null;
  let rawEmojiInput: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const token = args[i].trim();
    if (!token) continue;

    const nameFlagMatch = token.match(/^(?:--)?name[:=]?(.+)$/i);
    if (nameFlagMatch) {
      explicitName = nameFlagMatch[1];
      continue;
    }

    if (
      token.startsWith('<a:') ||
      token.startsWith('<:') ||
      token.startsWith('http://') ||
      token.startsWith('https://')
    ) {
      if (!rawEmojiInput) {
        rawEmojiInput = token;
      }
      continue;
    }

    if (!explicitName && !/^\d+$/.test(token)) {
      explicitName = token;
    }
  }

  return { explicitName, rawEmojiInput };
}

const manageEmojiPerm =
  PermissionFlagsBits.ManageGuildExpressions ?? PermissionFlagsBits.ManageEmojisAndStickers;

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('emojiadd')
    .setDescription('Adiciona um novo emoji ao servidor atual (Requer Gerenciar Emojis)')
    .addStringOption((option) =>
      option
        .setName('emoji')
        .setDescription('Emoji customizado do Discord (ex: <a:nome:id>) ou URL da imagem')
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('arquivo')
        .setDescription('Arquivo de imagem (PNG, GIF, WEBP) para enviar')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome customizado do emoji (opcional - extraído automaticamente se omitido)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(manageEmojiPerm),

  prefixAliases: ['emojiadd', 'addemoji', 'emojicreate', 'createemoji', 'adicionaremoji'],
  category: 'admin',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!emojiadd <emoji_ou_url> [nome] ou /emojiadd [emoji:<emoji>] [arquivo:<arquivo>] [nome:<nome>]',
    examples: [
      'k!emojiadd <a:kiss:1492107771510919300>',
      'k!emojiadd <a:kiss:1492107771510919300> meu_emoji_custom',
      'k!emojiadd https://cdn.discordapp.com/emojis/123456.gif dance',
      '/emojiadd emoji:<a:shooting:1492107771510919300>',
      '/emojiadd arquivo:[upload] nome:estelar',
    ],
    detailedDescription:
      'Baixa a imagem de um emoji customizado de outro servidor, URL de imagem ou arquivo anexado e cria um novo emoji no servidor atual. O nome é opcional e extraído automaticamente.',
    requiredPermissions: ['ManageGuildExpressions'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    const e = await getEmojis(ctx.client);

    // 1. Must be in a Guild
    if (!ctx.guild) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Comando Restrito`,
        'Este comando só pode ser utilizado dentro de um servidor.'
      );
      return;
    }

    // 2. User Permission Guard
    if (!ctx.memberPermissions?.has(manageEmojiPerm)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão Insuficiente`,
        'Você precisa da permissão de **Gerenciar Emojis e Figurinhas** no servidor para utilizar este comando.'
      );
      return;
    }

    // 3. Bot Permission Guard
    const botMember = ctx.guild.members.me;
    if (!botMember || !botMember.permissions.has(manageEmojiPerm)) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Permissão do Bot Ausente`,
        'Eu preciso da permissão de **Gerenciar Emojis e Figurinhas** neste servidor para adicionar emojis.'
      );
      return;
    }

    // 4. Cooldown Guard (5s)
    const cooldownLeft = emojiAddCooldowns.check(ctx.user.id);
    if (cooldownLeft > 0) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Aguarde um momento`,
        `Aguarde \`${cooldownLeft}s\` para adicionar outro emoji.`
      );
      return;
    }

    let explicitName: string | null = null;
    let rawEmojiInput: string | null = null;
    let fileAttachment: Attachment | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      rawEmojiInput = ctx.slashInteraction.options.getString('emoji');
      fileAttachment = ctx.slashInteraction.options.getAttachment('arquivo');
      explicitName = ctx.slashInteraction.options.getString('nome');
    } else {
      fileAttachment = ctx.message?.attachments.first() || null;
      const parsed = parsePrefixEmojiAddArgs(ctx.args, fileAttachment);
      explicitName = parsed.explicitName;
      rawEmojiInput = parsed.rawEmojiInput;
    }

    // 5. Must provide either emoji string/url or attachment
    if (!rawEmojiInput && !fileAttachment) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Fonte de Emoji Ausente`,
        'Você deve fornecer um **emoji customizado** (`<a:nome:id>`), uma **URL de imagem** ou um **arquivo anexado**.\n\n*Exemplo:* `k!emojiadd <a:dance:123456> meu_nome` ou `/emojiadd arquivo:[anexo]`'
      );
      return;
    }

    const emojiName = extractEmojiName(explicitName, rawEmojiInput, fileAttachment);

    if (!emojiName) {
      await sendErrorReply(
        ctx,
        `${e.WARNING} Nome do Emoji Inválido`,
        'Não foi possível extrair um nome válido para o emoji. O nome deve conter entre 2 e 32 caracteres (apenas letras, números e underscores).\n\n*Exemplo:* `k!emojiadd <emoji> meu_nome` ou `/emojiadd emoji:<emoji> nome:meu_nome`'
      );
      return;
    }

    emojiAddCooldowns.apply(ctx.user.id);

    try {
      await ctx.deferReply(true);

      let dataUri: string | null = null;

      if (fileAttachment) {
        dataUri = await fetchDiscordEmojiDataUri(fileAttachment.url);
      } else if (rawEmojiInput) {
        dataUri = await fetchDiscordEmojiDataUri(rawEmojiInput);
      }

      if (!dataUri) {
        await sendErrorReply(
          ctx,
          `${e.ERROR} Imagem Inválida ou Inacessível`,
          'Não foi possível baixar ou processar a imagem do emoji. Certifique-se de enviar uma imagem PNG, GIF ou WEBP válida.'
        );
        return;
      }

      // Create emoji in the guild
      const createdEmoji = await ctx.guild.emojis.create({
        attachment: dataUri,
        name: emojiName,
      });

      const successEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.SUCCESS} Emoji Adicionado ao Servidor!`,
        description: `O emoji **:${createdEmoji.name}:** foi adicionado com sucesso ao servidor **${ctx.guild.name}**!`,
        fields: [
          {
            name: `${e.RENDER} Emoji Renderizado`,
            value: `${createdEmoji.toString()}`,
            inline: true,
          },
          {
            name: `${e.LABEL} Marcação Copiável`,
            value: `\`${createdEmoji.toString()}\``,
            inline: true,
          },
          {
            name: `${e.ID} ID do Emoji`,
            value: `\`${createdEmoji.id}\``,
            inline: true,
          },
        ],
      });

      await ctx.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ [EmojiAdd Command Error]:', error);

      let failureDetail = error.message || String(error);
      if (error.code === 50035 || error.code === 30008) {
        failureDetail = 'O servidor atingiu o limite máximo de slots de emojis permitidos.';
      } else if (error.code === 50013) {
        failureDetail = 'O bot não possui permissão de Gerenciar Emojis neste servidor.';
      }

      await sendErrorReply(
        ctx,
        `${e.ERROR} Falha ao Adicionar Emoji`,
        `Ocorreu um erro ao criar o emoji no servidor: \`${failureDetail}\``
      );
    }
  },
};
