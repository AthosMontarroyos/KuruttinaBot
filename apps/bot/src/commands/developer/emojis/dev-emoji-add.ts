import { SlashCommandBuilder, APIEmbed, Attachment } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { getEmoji } from '../../../utils/emoji-resolver';
import { getEmojiAppConfigs, EmojiAppConfig } from '../../../utils/multi-app-helper';

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

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-add')
    .setDescription('[Dev Only] Importa e cria um Application Emoji em um dos apps vinculados')
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
    )
    .addIntegerOption((option) =>
      option
        .setName('app')
        .setDescription('ID da App Vault de destino (ex: 1 para Kuruttina, 2 para Emojis)')
        .setRequired(false)
    ),

  prefixAliases: ['dev-emoji-add', 'add-emoji', 'import-emoji'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-add <nome> <emoji_ou_url> [app_id] ou /dev-emoji-add nome:<nome> [emoji:<url>] [app:<id>]',
    examples: [
      '/dev-emoji-add nome:shooting emoji:<a:shooting:1492107771510919300> app:2',
      'k!dev-emoji-add verified https://cdn.discordapp.com/... 1',
    ],
    detailedDescription:
      'Baixa a imagem de um emoji customizado ou URL e cadastra diretamente no Discord Developer Portal de uma das aplicações vinculadas.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    // Restrito a Desenvolvedores / Servidor Dev
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    let emojiName = '';
    let rawEmojiInput: string | null = null;
    let fileAttachment: Attachment | null = null;
    let targetAppIndex: number | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      emojiName = ctx.slashInteraction.options.getString('nome', true).trim().toLowerCase();
      rawEmojiInput = ctx.slashInteraction.options.getString('emoji');
      fileAttachment = ctx.slashInteraction.options.getAttachment('arquivo');
      targetAppIndex = ctx.slashInteraction.options.getInteger('app');
    } else {
      emojiName = ctx.args[0]?.trim().toLowerCase();
      rawEmojiInput = ctx.args[1] || null;
      fileAttachment = ctx.message?.attachments.first() || null;
      if (ctx.args[2]) {
        const parsed = parseInt(ctx.args[2], 10);
        if (!isNaN(parsed)) targetAppIndex = parsed;
      }
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

      const allApps = await getEmojiAppConfigs();
      if (allApps.length === 0) {
        throw new Error('Nenhuma aplicação de emoji configurada no sistema.');
      }

      let selectedApp: EmojiAppConfig | null = null;
      if (targetAppIndex) {
        selectedApp = allApps.find((a) => a.id === targetAppIndex) || null;
        if (!selectedApp) {
          const warningEmoji = await getEmoji(ctx.client, 'WARNING');
          const errorEmbed: APIEmbed = {
            title: `${warningEmoji} App Não Encontrada`,
            description: `App ID **#${targetAppIndex}** não existe. Aplicações disponíveis: ${allApps
              .map((a) => `\`#${a.id}: ${a.name}\``)
              .join(', ')}`,
            color: EMBED_COLORS.BLACK.number,
          };
          await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }
      } else {
        // Auto-select app (default to app with available slot)
        selectedApp = allApps[0];
      }

      // Upload to chosen app client REST
      const { Client: DiscordClient, GatewayIntentBits } = await import('discord.js');
      const uploadClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds] });

      await new Promise<void>((resolve, reject) => {
        uploadClient.on('ready', async () => {
          try {
            if (!uploadClient.application) {
              throw new Error('client.application não está acessível na aplicação selecionada.');
            }

            const createdAppEmoji = await uploadClient.application.emojis.create({
              attachment: dataUri!,
              name: emojiName,
            });

            const successEmoji = await getEmoji(ctx.client, 'SUCCESS');
            const successEmbed: APIEmbed = {
              title: `${successEmoji} Application Emoji Criado!`,
              description: `O emoji **${createdAppEmoji.name}** foi importado com sucesso na App Vault **#${selectedApp!.id} (${selectedApp!.name})**!`,
              color: EMBED_COLORS.BLACK.number,
              fields: [
                {
                  name: '✨ Emoji Renderizado',
                  value: `${createdAppEmoji.toString()}`,
                  inline: true,
                },
                {
                  name: '🏷️ Marcação / Formato Copiável',
                  value: `\`${createdAppEmoji.toString()}\``,
                  inline: true,
                },
                {
                  name: '🆔 ID do Emoji',
                  value: `\`${createdAppEmoji.id}\``,
                  inline: true,
                },
                {
                  name: '📦 App Vault Destino',
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
            resolve();
          } catch (err) {
            reject(err);
          } finally {
            uploadClient.destroy();
          }
        });

        uploadClient.login(selectedApp.token).catch(reject);
      });
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
