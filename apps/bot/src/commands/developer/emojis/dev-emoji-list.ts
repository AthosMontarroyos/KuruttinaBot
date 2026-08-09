import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG, EMOJIS, EMOJI_CATEGORIES } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-list')
    .setDescription('Exibe a lista, utilidade e status de sincronização dos Emojis do Developer Portal'),
  prefixAliases: ['dev-emoji-list', 'devemojilist', 'emojilist'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-list',
    examples: ['/dev-emoji-list', 'k!dev-emoji-list'],
    detailedDescription:
      'Exibe o catálogo completo de Emojis de Aplicação cadastrados no Discord Developer Portal, agrupados por utilidade e categoria.',
    requiredPermissions: ['DeveloperOnly'],
  },

  async execute(ctx: CommandContext): Promise<void> {
    const isDev = await PermissionGuard.enforceDevOnly(ctx);
    if (!isDev) return;

    await ctx.deferReply(true);

    try {
      const client = ctx.client;
      if (!client.application) {
        throw new Error('Aplicação do Discord não inicializada.');
      }

      // Fetch Application Emojis from Discord Developer Portal
      const appEmojis = await client.application.emojis.fetch();
      const appEmojisMap = new Map(appEmojis.map((e) => [e.name?.toLowerCase(), e]));

      let totalMapped = 0;
      const categoryFields: { name: string; value: string; inline: boolean }[] = [];

      for (const category of EMOJI_CATEGORIES) {
        const lines: string[] = [];

        for (const key of category.keys) {
          const defaultUnicode = EMOJIS[key];
          const matchedAppEmoji = appEmojisMap.get(key.toLowerCase());

          if (matchedAppEmoji) {
            totalMapped++;
            lines.push(`• \`${key}\`: ${matchedAppEmoji.toString()} *(Customizado)*`);
          } else {
            lines.push(`• \`${key}\`: ${defaultUnicode} *(Unicode Padrão)*`);
          }
        }

        categoryFields.push({
          name: `📁 ${category.name}`,
          value: lines.join('\n'),
          inline: false,
        });
      }

      const totalDefined = Object.keys(EMOJIS).length;
      const embed: APIEmbed = {
        title: `🎨 Catálogo de Emojis do Developer Portal`,
        description: `Exibindo a utilidade e o status dos Emojis de Aplicação da **Kuruttina**.\n**Customizados no Portal:** \`${totalMapped}/${totalDefined}\` registrado(s).`,
        color: STATUS_COLORS.INFO.number,
        fields: categoryFields,
        footer: {
          text: `${DEFAULT_BOT_CONFIG.BOT_NAME} • Use /dev-emoji-add para importar novos emojis`,
          icon_url: client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ Erro ao listar emojis do Developer Portal:', error);
      const errorEmbed: APIEmbed = {
        title: `${EMOJIS.ERROR} Erro ao Listar Emojis`,
        description: `Ocorreu uma falha ao buscar os emojis no Developer Portal: \`${
          error.message || error
        }\``,
        color: STATUS_COLORS.ERROR.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
