import {
  SlashCommandBuilder,
  ComponentType,
  ButtonStyle,
  APIActionRowComponent,
  APIButtonComponent,
} from 'discord.js';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed, sendErrorReply, resolveGuild } from '../../../../utils';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('server-banner')
    .setDescription('Exibe e disponibiliza para download o banner do servidor (Requer Nível 2 de Impulso)')
    .addStringOption((option) =>
      option
        .setName('servidor')
        .setDescription('ID numérico do servidor do Discord')
        .setRequired(false)
    ),

  prefixAliases: ['server-banner', 'serverbanner', 'sbanner', 'bannerserver'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!server-banner [id_servidor] ou /server-banner [servidor:<id>]',
    examples: [
      '/server-banner',
      '/server-banner servidor:123456789012345678',
      'k!server-banner',
      'k!server-banner 123456789012345678',
      'k!sbanner 123456789012345678',
      'k!bannerserver',
    ],
    detailedDescription:
      'Busca e exibe em alta resolução (1024px) o banner de perfil do servidor atual ou de um servidor por ID. Banners de servidor são desbloqueados a partir do Nível 2 de Impulso (Server Boost).',
  },

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.deferReply();

    const e = await getEmojis(ctx.client);
    const targetGuild = await resolveGuild(ctx);

    if (!targetGuild) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Servidor Não Encontrado`,
        'Não foi possível encontrar nenhum servidor com o ID especificado. Verifique se o ID numérico está correto ou execute dentro de um servidor.'
      );
      return;
    }

    const banner = 'banner' in targetGuild ? targetGuild.banner : null;

    if (!banner) {
      const noBannerEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.INFO} Banner de ${targetGuild.name}`,
        description: `Este servidor não possui um banner customizado configurado.\n\n✨ **Requisito de Impulso:** Banners de servidor são desbloqueados a partir do **Nível 2 de Impulso (Server Boost)**.`,
      });

      await ctx.reply({ embeds: [noBannerEmbed] });
      return;
    }

    const isAnimated = banner.startsWith('a_');

    // Discord CDN URLs using ?animated=true parameter for live animation rendering (Level 2/3 Boost)
    const animatedWebpEmbedUrl = `https://cdn.discordapp.com/banners/${targetGuild.id}/${banner}.webp?animated=true&size=512`;
    const animatedWebpDownloadUrl = `https://cdn.discordapp.com/banners/${targetGuild.id}/${banner}.webp?animated=true&size=1024`;
    const pngUrl = `https://cdn.discordapp.com/banners/${targetGuild.id}/${banner}.png?size=1024`;

    const embedImageUrl = isAnimated ? animatedWebpEmbedUrl : pngUrl;
    const primaryBrowserUrl = isAnimated ? animatedWebpDownloadUrl : pngUrl;

    const bannerEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${targetGuild.name}`,
      image: { url: embedImageUrl },
    });

    const actionRow: APIActionRowComponent<APIButtonComponent> = {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: 'Abrir banner no navegador',
          url: primaryBrowserUrl,
        },
      ],
    };

    await ctx.reply({ embeds: [bannerEmbed], components: [actionRow] });
  },
};
