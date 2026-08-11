import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { getEmojiAppConfigs, withAppClient } from '../../../utils/multi-app-helper';
import { getEmoji } from '../../../utils/emoji-resolver';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-vault-list')
    .setDescription('[Dev Only] Lista todas as App Vaults (Aplicações vinculadas de armazenamento de emojis)'),
  prefixAliases: ['dev-vault-list', 'vaults', 'dev-vaults', 'app-vaults'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-vault-list ou /dev-vault-list',
    examples: ['/dev-vault-list', 'k!dev-vault-list', 'k!vaults'],
    detailedDescription:
      'Exibe todas as aplicações vinculadas de armazenamento de emojis (App Vaults), seus IDs de app, cota oficial do Discord (2.000 emojis por app), pastas de armazenamento local e status de disponibilidade.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    try {
      const appConfigs = await getEmojiAppConfigs();
      const fields: { name: string; value: string; inline: boolean }[] = [];
      let totalStaticEmojis = 0;
      let totalAnimatedEmojis = 0;
      const MAX_PER_APP = 2000;
      const totalCapacity = appConfigs.length * MAX_PER_APP;

      // Pre-fetch system Application Emojis per Rule 16
      const crownEmoji = await getEmoji(ctx.client, 'CROWN');
      const folderEmoji = await getEmoji(ctx.client, 'FOLDER');
      const shieldEmoji = await getEmoji(ctx.client, 'SHIELD');
      const photoEmoji = await getEmoji(ctx.client, 'PHOTO');
      const starEmoji = await getEmoji(ctx.client, 'STAR');
      const bulletEmoji = await getEmoji(ctx.client, 'BULLET');
      const warningEmoji = await getEmoji(ctx.client, 'WARNING');
      const statsEmoji = await getEmoji(ctx.client, 'STATS');
      const vaultEmoji = await getEmoji(ctx.client, 'VAULT');
      const labelEmoji = await getEmoji(ctx.client, 'LABEL');
      const idEmoji = await getEmoji(ctx.client, 'ID');
      const userEmoji = await getEmoji(ctx.client, 'USER');

      for (const appConfig of appConfigs) {
        try {
          await withAppClient(appConfig.token, async (fetchClient) => {
            if (!fetchClient.application) return;

            const appEmojis = await fetchClient.application.emojis.fetch();
            const staticCount = appEmojis.filter((e) => !e.animated).size;
            const animCount = appEmojis.filter((e) => e.animated).size;

            totalStaticEmojis += staticCount;
            totalAnimatedEmojis += animCount;

            const totalUsed = appEmojis.size;
            const remaining = MAX_PER_APP - totalUsed;

            const statusBadge = appConfig.isPrimary
              ? `${crownEmoji} **Bot Principal**`
              : `${vaultEmoji} **Vault Secundário (REST)**`;

            fields.push({
              name: `App #${appConfig.id}: ${appConfig.name} (${statusBadge})`,
              value: [
                `${bulletEmoji} ${userEmoji} **Bot User:** \`${appConfig.botTag || appConfig.name}\``,
                `${bulletEmoji} ${idEmoji} **Application ID:** \`${appConfig.appId || 'N/A'}\``,
                `${bulletEmoji} ${folderEmoji} **Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}/\``,
                `${bulletEmoji} ${photoEmoji} **Emojis Estáticos:** \`${staticCount}\` | ${starEmoji} **Animados:** \`${animCount}\``,
                `${bulletEmoji} ${labelEmoji} **Uso de Cota:** \`${totalUsed}/${MAX_PER_APP}\` (${remaining} vagas restantes)`,
              ].join('\n'),
              inline: false,
            });
          });
        } catch {
          fields.push({
            name: `App #${appConfig.id}: ${appConfig.name} (${warningEmoji} Erro de Conexão)`,
            value: `${bulletEmoji} **Status:** Não foi possível autenticar o token da aplicação.\n${bulletEmoji} **Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}/\``,
            inline: false,
          });
        }
      }

      const totalGlobal = totalStaticEmojis + totalAnimatedEmojis;

      const embed: APIEmbed = {
        title: `${shieldEmoji} Gerenciador de App Vaults de Emojis`,
        description: [
          `Visualizando **${appConfigs.length}** aplicação(ões) de emojis configurada(s) no ecossistema da **Kuruttina**.\n`,
          `${statsEmoji} **Cota Global Registrada (2.000 emojis por app):**`,
          `${folderEmoji} **Total de Emojis:** \`${totalGlobal}/${totalCapacity}\` (${totalCapacity - totalGlobal} vagas disponíveis globalmente)`,
          `${photoEmoji} **Estáticos Total:** \`${totalStaticEmojis}\` | ${starEmoji} **Animados Total:** \`${totalAnimatedEmojis}\``,
        ].join('\n'),
        color: EMBED_COLORS.BLACK.number,
        fields,
        footer: {
          text: `${DEFAULT_BOT_CONFIG.BOT_NAME} • Use /dev-emoji-add para fazer upload em uma vault`,
          icon_url: ctx.client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ Erro ao listar App Vaults:', error);
      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Erro ao Listar App Vaults`,
        description: `Ocorreu uma falha ao consultar as aplicações: \`${error.message || error}\``,
        color: EMBED_COLORS.BLACK.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
