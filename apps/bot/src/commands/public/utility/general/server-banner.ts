import {
  SlashCommandBuilder,
  ComponentType,
  ButtonStyle,
  APIActionRowComponent,
  APIButtonComponent,
} from 'discord.js';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed, sendErrorReply } from '../../../../utils';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('server-banner')
    .setDescription('Exibe e disponibiliza para download o banner do servidor atual (Requer Nível 2 de Impulso)'),

  prefixAliases: ['server-banner', 'serverbanner', 'sbanner', 'bannerserver'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!server-banner ou /server-banner',
    examples: [
      '/server-banner',
      'k!server-banner',
      'k!sbanner',
      'k!bannerserver',
    ],
    detailedDescription:
      'Busca e exibe em alta resolução (1024px) o banner de perfil do servidor atual. Banners de servidor são desbloqueados a partir do Nível 2 de Impulso (Server Boost).',
  },

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.deferReply();

    const e = await getEmojis(ctx.client);

    if (!ctx.guild) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Comando Restrito a Servidores`,
        'Este comando só pode ser executado dentro de um servidor do Discord.'
      );
      return;
    }

    if (!ctx.guild.banner) {
      const noBannerEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.INFO} Banner de ${ctx.guild.name}`,
        description: `Este servidor não possui um banner customizado configurado.\n\n${e.SERVER_BOOST} **Requisito de Impulso:** Banners de servidor são desbloqueados a partir do **Nível 2 de Impulso (Server Boost)**.`,
      });

      await ctx.reply({ embeds: [noBannerEmbed] });
      return;
    }

    const isAnimated = ctx.guild.banner.startsWith('a_');

    // Discord CDN URLs using ?animated=true parameter for live animation rendering (Level 2/3 Boost)
    const animatedWebpEmbedUrl = `https://cdn.discordapp.com/banners/${ctx.guild.id}/${ctx.guild.banner}.webp?animated=true&size=512`;
    const animatedWebpDownloadUrl = `https://cdn.discordapp.com/banners/${ctx.guild.id}/${ctx.guild.banner}.webp?animated=true&size=1024`;
    const pngUrl = `https://cdn.discordapp.com/banners/${ctx.guild.id}/${ctx.guild.banner}.png?size=1024`;

    const embedImageUrl = isAnimated ? animatedWebpEmbedUrl : pngUrl;
    const primaryBrowserUrl = isAnimated ? animatedWebpDownloadUrl : pngUrl;

    const bannerEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${ctx.guild.name}`,
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
