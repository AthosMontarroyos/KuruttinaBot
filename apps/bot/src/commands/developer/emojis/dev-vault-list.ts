import { SlashCommandBuilder, APIEmbed } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { getEmojiAppConfigs, EmojiAppConfig } from '../../../utils/multi-app-helper';
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
      'Exibe todas as aplicações vinculadas de armazenamento de emojis (App Vaults), seus IDs de app, estatísticas de cota (estáticos/animados), pastas de armazenamento local e status de disponibilidade.',
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
      let totalCapacity = appConfigs.length * 100;

      const { Client: DiscordClient, GatewayIntentBits } = await import('discord.js');

      for (const appConfig of appConfigs) {
        const fetchClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds] });

        await new Promise<void>((resolve) => {
          fetchClient.on('ready', async () => {
            try {
              if (!fetchClient.application) {
                resolve();
                return;
              }

              const appEmojis = await fetchClient.application.emojis.fetch();
              const staticCount = appEmojis.filter((e) => !e.animated).size;
              const animCount = appEmojis.filter((e) => e.animated).size;

              totalStaticEmojis += staticCount;
              totalAnimatedEmojis += animCount;

              const staticRem = 50 - staticCount;
              const animRem = 50 - animCount;
              const totalUsed = staticCount + animCount;

              const statusBadge = appConfig.isPrimary
                ? '👑 **Bot Principal**'
                : '📦 **Vault Secundário (REST)**';

              fields.push({
                name: `App #${appConfig.id}: ${appConfig.name} (${statusBadge})`,
                value: [
                  `• **Bot User:** \`${appConfig.botTag || appConfig.name}\``,
                  `• **Application ID:** \`${appConfig.appId || 'N/A'}\``,
                  `• **Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}/\``,
                  `• **Emojis Estáticos:** \`${staticCount}/50\` (Sobra: \`${staticRem}\`)`,
                  `• **Emojis Animados:** \`${animCount}/50\` (Sobra: \`${animRem}\`)`,
                  `• **Capacidade Total Usada:** \`${totalUsed}/100\` (${100 - totalUsed} vagas)`,
                ].join('\n'),
                inline: false,
              });
              resolve();
            } catch {
              fields.push({
                name: `App #${appConfig.id}: ${appConfig.name} (⚠️ Erro de Conexão)`,
                value: `• **Status:** Não foi possível autenticar o token da aplicação.\n• **Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}/\``,
                inline: false,
              });
              resolve();
            } finally {
              fetchClient.destroy();
            }
          });

          fetchClient.login(appConfig.token).catch(() => {
            fields.push({
              name: `App #${appConfig.id}: ${appConfig.name} (⚠️ Token Inválido)`,
              value: `• **Status:** Falha no login REST API. Verifique as credenciais no \`.env\`.`,
              inline: false,
            });
            resolve();
          });
        });
      }

      const totalGlobal = totalStaticEmojis + totalAnimatedEmojis;
      const shieldEmoji = await getEmoji(ctx.client, 'SHIELD');
      const folderEmoji = await getEmoji(ctx.client, 'FOLDER');

      const embed: APIEmbed = {
        title: `${shieldEmoji} Gerenciador de App Vaults de Emojis`,
        description: [
          `Visualizando **${appConfigs.length}** aplicação(ões) de emojis configurada(s) no ecossistema da **Kuruttina**.\n`,
          `📊 **Cota Global Registrada:**`,
          `${folderEmoji} **Total de Emojis:** \`${totalGlobal}/${totalCapacity}\` (${totalCapacity - totalGlobal} vagas disponíveis)`,
          `🖼️ **Estáticos:** \`${totalStaticEmojis}/${appConfigs.length * 50}\` | 🎬 **Animados:** \`${totalAnimatedEmojis}/${appConfigs.length * 50}\``,
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
