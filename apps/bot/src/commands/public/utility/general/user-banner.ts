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
import { getEmojis, createKuruttinaEmbed, sendErrorReply } from '../../../../utils';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('user-banner')
    .setDescription('Exibe e disponibiliza para download o banner de perfil de um usuário por menção ou ID')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário do Discord para visualizar o banner')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('ID numérico do usuário do Discord (ex: 123456789012345678)')
        .setRequired(false)
    ),

  prefixAliases: ['user-banner', 'userbanner', 'banner', 'ubanner', 'banneruser'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!user-banner [usuario_ou_id] ou /user-banner [usuario:<usuario>] [id:<id>]',
    examples: [
      '/user-banner',
      '/user-banner usuario:@Membro',
      '/user-banner id:123456789012345678',
      'k!user-banner',
      'k!banner @Membro',
      'k!banner 123456789012345678',
    ],
    detailedDescription:
      'Busca e exibe em alta resolução (1024px) o banner de perfil de qualquer usuário do Discord por menção ou ID com o estilo característico da Kuruttina.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.deferReply();

    const e = await getEmojis(ctx.client);
    let targetId: string = ctx.user.id;

    if (ctx.isSlash && ctx.slashInteraction) {
      const explicitId = ctx.slashInteraction.options.getString('id');
      const optionUser = ctx.slashInteraction.options.getUser('usuario');

      if (explicitId) {
        const idMatch = explicitId.match(/\d{17,20}/);
        targetId = idMatch ? idMatch[0] : explicitId.trim();
      } else if (optionUser) {
        targetId = optionUser.id;
      }
    } else {
      if (ctx.args[0]) {
        const rawArg = ctx.args[0].trim();
        const idMatch = rawArg.match(/\d{17,20}/);
        if (idMatch) {
          targetId = idMatch[0];
        }
      }
    }

    let fetchedUser: User | null = null;
    try {
      // Force fetch to ensure full profile details (including banner hash & accent color) are loaded directly from Discord REST API
      fetchedUser = await ctx.client.users.fetch(targetId, { force: true });
    } catch {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Usuário Não Encontrado`,
        `Não foi possível encontrar nenhum usuário do Discord com o ID \`${targetId}\`. Verifique se o ID está correto.`
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

    const isSelf = fetchedUser.id === ctx.user.id;
    const isAnimated = fetchedUser.banner.startsWith('a_');

    // Discord CDN URLs
    const animatedWebpEmbedUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.webp?animated=true&size=512`;
    const animatedWebpDownloadUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.webp?animated=true&size=1024`;
    const pngUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.png?size=1024`;
    const jpgUrl = `https://cdn.discordapp.com/banners/${fetchedUser.id}/${fetchedUser.banner}.jpg?size=1024`;

    const embedImageUrl = isAnimated ? animatedWebpEmbedUrl : pngUrl;
    const primaryBrowserUrl = isAnimated ? animatedWebpDownloadUrl : pngUrl;

    const linksList = isAnimated
      ? [`[WebP Animado](${animatedWebpDownloadUrl})`, `[PNG](${pngUrl})`, `[JPG](${jpgUrl})`]
      : [`[PNG](${pngUrl})`, `[JPG](${jpgUrl})`];

    const infjQuote = isSelf
      ? '*Apesar de tudo, a sua essência visual permanece marcante.*'
      : `*Um vislumbre sobre a identidade de **${fetchedUser.username}**.*`;

    const bannerEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${fetchedUser.username}`,
      description: `${infjQuote}\n\n📥 **Downloads:** ${linksList.join(' • ')}`,
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
