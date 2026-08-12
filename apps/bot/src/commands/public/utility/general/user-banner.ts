import {
  SlashCommandBuilder,
  User,
  ComponentType,
  ButtonStyle,
  APIActionRowComponent,
  APIButtonComponent,
} from 'discord.js';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed, sendErrorReply, resolveUser } from '../../../../utils';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('user-banner')
    .setDescription('Exibe e disponibiliza para download o banner de perfil de um usuário por menção ou ID')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário por menção (@usuario) ou ID numérico do Discord')
        .setRequired(false)
    ),

  prefixAliases: ['user-banner', 'userbanner', 'banner', 'ubanner', 'banneruser'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!user-banner [usuario_ou_id] ou /user-banner [usuario:<menção_ou_id>]',
    examples: [
      '/user-banner',
      '/user-banner usuario:@Membro',
      '/user-banner usuario:123456789012345678',
      'k!user-banner',
      'k!banner @Membro',
      'k!banner 123456789012345678',
    ],
    detailedDescription:
      'Busca e exibe em alta resolução (1024px) o banner de perfil de qualquer usuário do Discord por menção ou ID.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.deferReply();

    const e = await getEmojis(ctx.client);
    const fetchedUser = await resolveUser(ctx, null, { forceFetch: true, fallbackToAuthor: true });

    if (!fetchedUser) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Usuário Não Encontrado`,
        'Não foi possível encontrar nenhum usuário do Discord com a menção ou ID especificado.'
      );
      return;
    }

    if (!fetchedUser.banner) {
      const accentInfo = fetchedUser.hexAccentColor
        ? `\n\n🎨 **Cor de Destaque:** \`${fetchedUser.hexAccentColor}\``
        : '';

      const noBannerEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.INFO} Banner de ${fetchedUser.username}`,
        description: `Este usuário não possui um banner customizado configurado em seu perfil.${accentInfo}`,
        color: fetchedUser.accentColor ?? undefined,
      });

      await ctx.reply({ embeds: [noBannerEmbed] });
      return;
    }

    const isAnimated = fetchedUser.banner.startsWith('a_');

    // Discord CDN URLs using ?animated=true parameter for live animation rendering
    const animatedWebpEmbedUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.webp?animated=true&size=512`;
    const animatedWebpDownloadUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.webp?animated=true&size=1024`;
    const pngUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.png?size=1024`;

    const embedImageUrl = isAnimated ? animatedWebpEmbedUrl : pngUrl;
    const primaryBrowserUrl = isAnimated ? animatedWebpDownloadUrl : pngUrl;

    const bannerEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${fetchedUser.username}`,
      image: { url: embedImageUrl },
      color: fetchedUser.accentColor ?? undefined,
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
