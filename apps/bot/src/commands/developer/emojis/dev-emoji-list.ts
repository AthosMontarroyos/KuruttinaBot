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
    .setName('dev-emoji-list')
    .setDescription('[Dev Only] Lista o catálogo de emojis de todas as aplicações vinculadas com tags formatadas'),
  prefixAliases: ['dev-emoji-list', 'emojis', 'dev-emojis', 'catalog-emojis'],
  category: 'developer',
  subCategory: 'emojis',
  guide: {
    syntax: 'k!dev-emoji-list ou /dev-emoji-list',
    examples: ['/dev-emoji-list', 'k!dev-emoji-list', 'k!emojis'],
    detailedDescription:
      'Exibe todas as aplicações vinculadas, a lista completa de Application Emojis cadastrados em cada uma delas e a notação formatada para copiar e usar em embeds.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const isAllowed = await PermissionGuard.enforceDevOnly(ctx);
    if (!isAllowed) return;

    await ctx.deferReply(true);
    const e = await getEmojis(ctx.client);

    try {
      const appConfigs = await getEmojiAppConfigs();
      const fields: { name: string; value: string; inline: boolean }[] = [];
      let totalGlobalEmojis = 0;

      for (const appConfig of appConfigs) {
        try {
          await withAppClient(appConfig.token, async (fetchClient) => {
            if (!fetchClient.application) return;

            const appEmojis = await fetchClient.application.emojis.fetch();
            totalGlobalEmojis += appEmojis.size;

            if (appEmojis.size === 0) {
              fields.push({
                name: `${e.VAULT} App #${appConfig.id}: ${appConfig.name} (0/2000)`,
                value: `*Nenhum emoji cadastrado nesta aplicação (Pasta: \`Pictures/emojis/${appConfig.sanitizedFolderName}\`)*`,
                inline: false,
              });
            } else {
              const staticCount = appEmojis.filter((emoji) => !emoji.animated).size;
              const animCount = appEmojis.filter((emoji) => emoji.animated).size;
              const lines: string[] = [];

              appEmojis.forEach((emoji) => {
                const tag = emoji.toString();
                lines.push(`${tag} \`${tag}\` | \`${emoji.name}\``);
              });

              const chunkedValue = lines.join('\n');
              const safeValue =
                chunkedValue.length > 1000
                  ? chunkedValue.substring(0, 990) + '\n... (demais omitidos)'
                  : chunkedValue;

              fields.push({
                name: `${e.VAULT} App #${appConfig.id}: ${appConfig.name} (${appEmojis.size}/2000 - ${e.PHOTO} Estáticos: ${staticCount} | ${e.STAR} Animados: ${animCount})`,
                value: `**${e.FOLDER} Pasta Local:** \`Pictures/emojis/${appConfig.sanitizedFolderName}\`\n${safeValue}`,
                inline: false,
              });
            }
          });
        } catch {
          // Ignore app fetch failures silently
        }
      }

      const embed = createKuruttinaEmbed(ctx.client, {
        title: `${e.INFO} Catálogo Multi-App de Emojis do Developer Portal`,
        description: `Exibindo todas as **${appConfigs.length}** aplicações vinculadas e a marcação formatada de cada emoji (\`<:nome:id>\` ou \`<a:nome:id>\`).\n**${e.LABEL} Total Global de Emojis:** \`${totalGlobalEmojis}\` registrado(s).`,
        fields,
        footerText: 'Use /dev-emoji-add para importar novos emojis',
      });

      await ctx.reply({ embeds: [embed], ephemeral: true });
    } catch (error: any) {
      console.error('❌ Erro ao listar emojis multi-app:', error);
      await sendErrorReply(
        ctx,
        `${e.ERROR} Erro ao Listar Emojis`,
        `Ocorreu uma falha ao buscar os emojis das aplicações: \`${error.message || error}\``
      );
    }
  },
};

