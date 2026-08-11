import { SlashCommandBuilder, APIEmbed, Events } from 'discord.js';
import { EMBED_COLORS, DEFAULT_BOT_CONFIG } from '@kuruttina/shared';
import { CommandContext } from '../../../types/command-context';
import { CommandModule } from '../../../types/command-interface';
import { PermissionGuard } from '../../../utils/permission-guard';
import { getEmojiAppConfigs, EmojiAppConfig } from '../../../utils/multi-app-helper';
import { getEmoji } from '../../../utils/emoji-resolver';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('dev-emoji-list')
    .setDescription('[Dev Only] Lista todos os emojis das aplicações vinculadas e suas marcações'),
  prefixAliases: ['dev-emoji-list', 'emojis-list'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-list ou /dev-emoji-list',
    examples: ['/dev-emoji-list', 'k!dev-emoji-list'],
    detailedDescription:
      'Exibe o catálogo completo de emojis ativos em todas as aplicações vinculadas no Developer Portal, suas marcações formatadas (<:nome:id>) e o app de origem.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    // Restrito a Desenvolvedores / Servidor Dev
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);

    try {
      const appConfigs = await getEmojiAppConfigs();
      const fields: { name: string; value: string; inline: boolean }[] = [];
      let totalGlobalEmojis = 0;

      const { Client: DiscordClient, GatewayIntentBits } = await import('discord.js');

      for (const appConfig of appConfigs) {
        const fetchClient = new DiscordClient({ intents: [GatewayIntentBits.Guilds] });

        await new Promise<void>((resolve) => {
          fetchClient.on(Events.ClientReady, async () => {
            try {
              if (!fetchClient.application) {
                resolve();
                return;
              }

              const appEmojis = await fetchClient.application.emojis.fetch();
              totalGlobalEmojis += appEmojis.size;

              if (appEmojis.size === 0) {
                fields.push({
                  name: `📦 App #${appConfig.id}: ${appConfig.name} (0/2000)`,
                  value: `*Nenhum emoji cadastrado nesta aplicação (Pasta: \`Pictures/emojis/${appConfig.sanitizedFolderName}\`)*`,
                  inline: false,
                });
              } else {
                const staticCount = appEmojis.filter((e) => !e.animated).size;
                const animCount = appEmojis.filter((e) => e.animated).size;
                const lines: string[] = [];

                appEmojis.forEach((e) => {
                  const tag = e.toString();
                  lines.push(`${tag} \`${tag}\` | \`${e.name}\``);
                });

                const chunkedValue = lines.join('\n');
                const safeValue = chunkedValue.length > 1000 ? chunkedValue.substring(0, 990) + '\n... (demais omitidos)' : chunkedValue;

                fields.push({
                  name: `📦 App #${appConfig.id}: ${appConfig.name} (${appEmojis.size}/2000 - Estáticos: ${staticCount} | Animados: ${animCount})`,
                  value: `**Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}\`\n${safeValue}`,
                  inline: false,
                });
              }
              resolve();
            } catch {
              resolve();
            } finally {
              fetchClient.destroy();
            }
          });

          fetchClient.login(appConfig.token).catch(() => resolve());
        });
      }

      const infoEmoji = await getEmoji(ctx.client, 'INFO');
      const embed: APIEmbed = {
        title: `${infoEmoji} Catálogo Multi-App de Emojis do Developer Portal`,
        description: `Exibindo todas as **${appConfigs.length}** aplicações vinculadas e a marcação formatada de cada emoji (\`<:nome:id>\` ou \`<a:nome:id>\`).\n**Total Global de Emojis:** \`${totalGlobalEmojis}\` registrado(s).`,
        color: EMBED_COLORS.BLACK.number,
        fields,
        footer: {
          text: `${DEFAULT_BOT_CONFIG.BOT_NAME} • Use /dev-emoji-add para importar novos emojis`,
          icon_url: ctx.client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ Erro ao listar emojis multi-app:', error);
      const errorEmoji = await getEmoji(ctx.client, 'ERROR');
      const errorEmbed: APIEmbed = {
        title: `${errorEmoji} Erro ao Listar Emojis`,
        description: `Ocorreu uma falha ao buscar os emojis das aplicações: \`${
          error.message || error
        }\``,
        color: EMBED_COLORS.BLACK.number,
      };
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
