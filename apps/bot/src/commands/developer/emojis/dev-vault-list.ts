import { SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import {
  PermissionGuard,
  getEmojiAppConfigs,
  withAppClient,
  getEmojis,
  createKuruttinaEmbed,
  sendErrorReply,
} from '../../../utils';

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
    const e = await getEmojis(ctx.client);

    try {
      const appConfigs = await getEmojiAppConfigs();
      const fields: { name: string; value: string; inline: boolean }[] = [];
      let totalStaticEmojis = 0;
      let totalAnimatedEmojis = 0;
      const MAX_PER_APP = 2000;
      const totalCapacity = appConfigs.length * MAX_PER_APP;

      for (const appConfig of appConfigs) {
        try {
          await withAppClient(appConfig.token, async (fetchClient) => {
            if (!fetchClient.application) return;

            const appEmojis = await fetchClient.application.emojis.fetch();
            const staticCount = appEmojis.filter((emoji) => !emoji.animated).size;
            const animCount = appEmojis.filter((emoji) => emoji.animated).size;

            totalStaticEmojis += staticCount;
            totalAnimatedEmojis += animCount;

            const totalUsed = appEmojis.size;
            const remaining = MAX_PER_APP - totalUsed;

            const statusBadge = appConfig.isPrimary
              ? `${e.CROWN} **Bot Principal**`
              : `${e.VAULT} **Vault Secundário (REST)**`;

            fields.push({
              name: `App #${appConfig.id}: ${appConfig.name} (${statusBadge})`,
              value: [
                `${e.BULLET} ${e.USER} **Bot User:** \`${appConfig.botTag || appConfig.name}\``,
                `${e.BULLET} ${e.ID} **Application ID:** \`${appConfig.appId || 'N/A'}\``,
                `${e.BULLET} ${e.FOLDER} **Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}/\``,
                `${e.BULLET} ${e.PHOTO} **Emojis Estáticos:** \`${staticCount}\` | ${e.STAR} **Animados:** \`${animCount}\``,
                `${e.BULLET} ${e.LABEL} **Uso de Cota:** \`${totalUsed}/${MAX_PER_APP}\` (${remaining} vagas restantes)`,
              ].join('\n'),
              inline: false,
            });
          });
        } catch {
          fields.push({
            name: `App #${appConfig.id}: ${appConfig.name} (${e.WARNING} Erro de Conexão)`,
            value: `${e.BULLET} **Status:** Não foi possível autenticar o token da aplicação.\n${e.BULLET} **Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}/\``,
            inline: false,
          });
        }
      }

      const totalGlobal = totalStaticEmojis + totalAnimatedEmojis;

      const embed = createKuruttinaEmbed(ctx.client, {
        title: `${e.SHIELD} Gerenciador de App Vaults de Emojis`,
        description: [
          `Visualizando **${appConfigs.length}** aplicação(ões) de emojis configurada(s) no ecossistema da **Kuruttina**.\n`,
          `${e.STATS} **Cota Global Registrada (2.000 emojis por app):**`,
          `${e.FOLDER} **Total de Emojis:** \`${totalGlobal}/${totalCapacity}\` (${totalCapacity - totalGlobal} vagas disponíveis globalmente)`,
          `${e.PHOTO} **Estáticos Total:** \`${totalStaticEmojis}\` | ${e.STAR} **Animados Total:** \`${totalAnimatedEmojis}\``,
        ].join('\n'),
        fields,
        footerText: 'Use /dev-emoji-add para fazer upload em uma vault',
      });

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ Erro ao listar App Vaults:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Erro ao Listar App Vaults`,
        `Ocorreu uma falha ao consultar as aplicações: \`${error.message || error}\``
      );
    }
  },
};

