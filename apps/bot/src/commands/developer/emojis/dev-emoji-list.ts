import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { EMOJIS, EMOJI_CATEGORIES, EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { KuruttinaClient } from '../../../types/kuruttina-client';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-list')
    .setDescription('[Dev Only] Lista todos os emojis do Developer Portal e status de mapeamento'),
  prefixAliases: ['dev-emoji-list', 'emojis-list'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-list ou /dev-emoji-list',
    examples: ['/dev-emoji-list', 'k!dev-emoji-list'],
    detailedDescription:
      'Exibe o catálogo completo de emojis ativos no Discord Developer Portal, mapeamento com as chaves do bot e fallbacks Unicode.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    // Restrito a Desenvolvedores / Servidor Dev
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    const client = ctx.client as KuruttinaClient;

    try {
      if (!client.application) {
        throw new Error('client.application não está acessível no cliente.');
      }

      // Fetch all live custom Application Emojis uploaded to Discord Developer Portal
      const appEmojis = await client.application.emojis.fetch();

      const categoryFields: { name: string; value: string; inline: boolean }[] = [];
      let totalMapped = 0;

      for (const category of EMOJI_CATEGORIES) {
        const lines: string[] = [];

        for (const key of category.keys) {
          const defaultUnicode = EMOJIS[key];

          const matchedAppEmoji = appEmojis.find(
            (e) => e.name?.toLowerCase() === key.toLowerCase()
          );

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
        color: EMBED_COLORS.BLACK.number,
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
        color: EMBED_COLORS.BLACK.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
