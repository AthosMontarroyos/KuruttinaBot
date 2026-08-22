import path from 'path';
import { ApplicationEmoji, SlashCommandBuilder, APIEmbed, Attachment } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG, sanitizeEmojiName } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import {
  PermissionGuard,
  getEmojis,
  getEmojiAppConfigs,
  withAppClient,
  EmojiAppConfig,
  fetchDiscordEmojiDataUri,
} from '../../../utils';

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


function getApplicationEmojiImageUrl(emoji: ApplicationEmoji): string | null {
  try {
    return emoji.imageURL({
      extension: emoji.animated ? 'gif' : 'webp',
      size: 256,
    });
  } catch {
    return null;
  }
}
/**
 * Smart Prefix Argument Parser.
 * Supports selectors from the JSON (app:ManosabaGirls, --app=Kiss),
 * while keeping numeric app IDs working for existing prefix commands.
 */
function parsePrefixEmojiAddArgs(args: string[], attachment: Attachment | null) {
  let explicitName: string | null = null;
  let rawEmojiInput: string | null = null;
  let targetAppSelector: string | null = null;
  const positionalTokens: string[] = [];

  for (const rawToken of args) {
    const token = rawToken.trim();
    if (!token) continue;

    const flagMatch = token.match(/^(?:--)?app[:=](.+)$/i);
    if (flagMatch) {
      targetAppSelector = flagMatch[1].trim();
      continue;
    }

    const nameFlagMatch = token.match(/^(?:--)?name[:=](.+)$/i);
    if (nameFlagMatch) {
      explicitName = nameFlagMatch[1].trim();
      continue;
    }

    if (
      token.startsWith('<a:') ||
      token.startsWith('<:') ||
      token.startsWith('http://') ||
      token.startsWith('https://')
    ) {
      if (!rawEmojiInput) rawEmojiInput = token;
      continue;
    }

    const numberMatch = token.match(/^#?(\d+)$/);
    if (numberMatch && !targetAppSelector) {
      targetAppSelector = numberMatch[1];
      continue;
    }

    positionalTokens.push(token);
  }

  if (!targetAppSelector && positionalTokens.length > 1) {
    targetAppSelector = positionalTokens.shift() || null;
  }

  if (!explicitName && positionalTokens.length > 0) {
    explicitName = positionalTokens.join('_');
  }

  return { explicitName, rawEmojiInput, targetAppSelector };
}

function normalizeAppSelector(value: string): string {
  return value
    .trim()
    .replace(/^#/, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function appMatchesSelector(app: EmojiAppConfig, selector: string): boolean {
  const normalizedSelector = normalizeAppSelector(selector);
  const candidates = [app.selector, ...app.aliases, app.name, app.sanitizedFolderName, String(app.id), '#' + app.id];
  return candidates.some((candidate) => normalizeAppSelector(candidate) === normalizedSelector);
}

function resolveAppConfig(apps: EmojiAppConfig[], selector: string): EmojiAppConfig | null {
  return apps.find((app) => appMatchesSelector(app, selector)) || null;
}

function formatAvailableApps(apps: EmojiAppConfig[]): string {
  const codeMark = String.fromCharCode(96);
  return apps
    .map((app) => codeMark + app.selector + codeMark + ' — ' + (app.isPrimary ? 'Vault principal' : 'Vault secundária') + ': ' + app.name)
    .join('\n');
}

function getAppChoiceName(app: EmojiAppConfig): string {
  const scope = app.isPrimary ? 'Principal' : 'Secundária';
  const category = app.category && app.category !== 'primary' ? ' · ' + app.category : '';
  return (scope + ': ' + app.name + category).slice(0, 100);
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
        .setDescription('Imagem PNG, JPEG, GIF, WEBP ou AVIF (máx. 10 MiB)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('app')
        .setDescription('App Vault de destino; selecione pelo nome (omita para usar a vault principal)')
        .setAutocomplete(true)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome customizado do emoji (opcional - extraído automaticamente se omitido)')
        .setRequired(false)
    ),

  autocomplete: async (interaction) => {
    const query = interaction.options.getString('app') || '';
    const apps = await getEmojiAppConfigs({ discoverRemote: false });
    const normalizedQuery = normalizeAppSelector(query);

    const choices = apps
      .filter((app) => {
        if (!normalizedQuery) return true;
        return [app.selector, ...app.aliases, app.name, app.sanitizedFolderName]
          .some((candidate) => normalizeAppSelector(candidate).includes(normalizedQuery));
      })
      .slice(0, 25)
      .map((app) => ({
        name: getAppChoiceName(app),
        value: app.selector.slice(0, 100),
      }));

    await interaction.respond(choices);
  },

  prefixAliases: ['dev-emoji-add', 'add-emoji', 'import-emoji'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-add <emoji_ou_url> [app] [nome] ou /dev-emoji-add emoji:<emoji> [app:<seletor>] [nome:<nome>]',
    examples: [
      'k!dev-emoji-add <a:kiss:1492107771510919300>',
      'k!dev-emoji-add <a:kiss:1492107771510919300> app:Kiss',
      'k!dev-emoji-add <a:kiss:1492107771510919300> app:ManosabaGirls meu_nome_customizado',
      '/dev-emoji-add emoji:<a:shooting:1492107771510919300> app:Kiss',
    ],
    detailedDescription:
      'Baixa a imagem de um emoji customizado ou URL e cadastra diretamente no Discord Developer Portal. Sem app informado, usa a vault principal; com app informado, usa a aplicação selecionada no JSON de vaults.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    const e = await getEmojis(ctx.client);

    let explicitName: string | null = null;
    let rawEmojiInput: string | null = null;
    let fileAttachment: Attachment | null = null;
    let targetAppSelector: string | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      rawEmojiInput = ctx.slashInteraction.options.getString('emoji');
      fileAttachment = ctx.slashInteraction.options.getAttachment('arquivo');
      targetAppSelector = ctx.slashInteraction.options.getString('app');
      explicitName = ctx.slashInteraction.options.getString('nome');
    } else {
      fileAttachment = ctx.message?.attachments.first() || null;
      const parsed = parsePrefixEmojiAddArgs(ctx.args, fileAttachment);
      explicitName = parsed.explicitName;
      rawEmojiInput = parsed.rawEmojiInput;
      targetAppSelector = parsed.targetAppSelector;
    }

    const emojiName = extractEmojiName(explicitName, rawEmojiInput, fileAttachment);

    if (!emojiName) {
      const errorEmbed: APIEmbed = {
        title: `${e.WARNING} Nome do Emoji Não Identificado`,
        description:
          'Não foi possível extrair o nome do emoji automaticamente. Forneça o nome no final: `k!dev-emoji-add <emoji> app:Kiss meu_nome` ou `/dev-emoji-add emoji:<emoji> app:Kiss nome:meu_nome`',
        color: EMBED_COLORS.BLACK.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    try {
      let dataUri: string | null = null;

      if (fileAttachment) {
        dataUri = await fetchDiscordEmojiDataUri(fileAttachment.url, {
          contentType: fileAttachment.contentType,
          size: fileAttachment.size,
          consumer: 'dev-emoji-add',
        });
      } else if (rawEmojiInput) {
        dataUri = await fetchDiscordEmojiDataUri(rawEmojiInput, {
          consumer: 'dev-emoji-add',
        });
      }

      if (!dataUri) {
        const errorEmbed: APIEmbed = {
          title: `${e.ERROR} Imagem Inválida ou Inacessível`,
          description:
            'Forneça um emoji customizado do Discord, uma URL ou um arquivo PNG, JPEG, GIF, WEBP ou AVIF válido de até 10 MiB.',
          color: EMBED_COLORS.BLACK.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      const allApps = await getEmojiAppConfigs({ discoverRemote: false });
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
      if (targetAppSelector) {
        selectedApp = resolveAppConfig(allApps, targetAppSelector);
        if (!selectedApp) {
          const errorEmbed: APIEmbed = {
            title: e.WARNING + ' App Não Encontrada',
            description: [
              'O seletor de app "' + targetAppSelector + '" não existe.',
              'Aplicações disponíveis:',
              formatAvailableApps(allApps),
            ].join('\n'),
            color: EMBED_COLORS.BLACK.number,
          };
          await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
          return;
        }
      } else {
        selectedApp = allApps[0];
      }

      if (!selectedApp) {
        const errorEmbed: APIEmbed = {
          title: e.ERROR + ' Nenhuma App Vault Configurada',
          description: 'A vault principal e as vaults secundárias não foram encontradas na configuração.',
          color: EMBED_COLORS.BLACK.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
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
          const existingEmojiImageUrl = getApplicationEmojiImageUrl(existingByName as ApplicationEmoji);
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
                value: `Para salvar outro emoji parecido nesta mesma Vault, especifique um nome diferente no final: \`k!dev-emoji-add <emoji> app:${selectedApp!.selector} ${emojiName}_2\``,
                inline: false,
              },
            ],
            footer: {
              text: DEFAULT_BOT_CONFIG.BOT_NAME,
              icon_url: ctx.client.user?.displayAvatarURL(),
            },
            timestamp: new Date().toISOString(),
          };

          if (existingEmojiImageUrl) {
            warningEmbed.image = { url: existingEmojiImageUrl };
          }

          await ctx.reply({ embeds: [warningEmbed], ephemeral: true });
          return;
        }

        const createdAppEmoji = await uploadClient.application.emojis.create({
          attachment: dataUri!,
          name: emojiName,
        });
        const createdEmojiImageUrl = getApplicationEmojiImageUrl(createdAppEmoji);

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

        if (createdEmojiImageUrl) {
          successEmbed.image = { url: createdEmojiImageUrl };
        }

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
