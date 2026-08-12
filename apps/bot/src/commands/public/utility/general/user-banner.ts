import { SlashCommandBuilder, User } from 'discord.js';
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
      'Busca e exibe em alta resolução o banner de perfil de qualquer usuário do Discord por menção ou ID. Suporta banners estáticos e animados (GIF).',
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
      // Force fetch to ensure full profile details (including banner hash & accent color) are loaded
      fetchedUser = await ctx.client.users.fetch(targetId, { force: true });
    } catch {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Usuário Não Encontrado`,
        `Não foi possível encontrar nenhum usuário do Discord com o ID \`${targetId}\`. Verifique se o ID está correto.`
      );
      return;
    }

    // Check for Guild Member specific banner first, fallback to Global User banner
    let bannerHash: string | null = null;
    let isGuildBanner = false;

    if (ctx.guild) {
      const member = await ctx.guild.members.fetch(targetId).catch(() => null);
      if (member && member.banner) {
        bannerHash = member.banner;
        isGuildBanner = true;
      }
    }

    if (!bannerHash && fetchedUser.banner) {
      bannerHash = fetchedUser.banner;
    }

    if (!bannerHash) {
      const accentInfo = fetchedUser.hexAccentColor
        ? `\n\n🎨 **Cor de Destaque (Accent Color):** \`${fetchedUser.hexAccentColor}\``
        : '';

      const noBannerEmbed = createKuruttinaEmbed(ctx.client, {
        title: `${e.INFO} Banner Não Configurado`,
        description: `O usuário **${fetchedUser.username}** (\`${fetchedUser.tag}\`) não possui um banner customizado em seu perfil.${accentInfo}`,
        color: fetchedUser.accentColor ?? undefined,
        fields: [
          {
            name: `${e.USER} Usuário`,
            value: `**${fetchedUser.username}**`,
            inline: true,
          },
          {
            name: `${e.ID} ID`,
            value: `\`${fetchedUser.id}\``,
            inline: true,
          },
        ],
      });

      await ctx.reply({ embeds: [noBannerEmbed] });
      return;
    }

    const isAnimated = bannerHash.startsWith('a_');
    const defaultExt = isAnimated ? 'gif' : 'png';

    // Construct CDN URLs
    const cdnBase = isGuildBanner
      ? `https://cdn.discordapp.com/guilds/${ctx.guild!.id}/users/${targetId}/banners/${bannerHash}`
      : `https://cdn.discordapp.com/banners/${targetId}/${bannerHash}`;

    // Use 512px for embed image to prevent Discord Proxy 8MB payload limit failure on heavy GIF banners
    const embedBannerUrl = `${cdnBase}.${defaultExt}?size=512`;

    // 1024px High-Res Download Links
    const pngUrl = `${cdnBase}.png?size=1024`;
    const jpgUrl = `${cdnBase}.jpg?size=1024`;
    const webpUrl = `${cdnBase}.webp?size=1024`;
    const gifUrl = isAnimated ? `${cdnBase}.gif?size=1024` : null;

    const linksList = [
      `[PNG](${pngUrl})`,
      `[JPG](${jpgUrl})`,
      `[WEBP](${webpUrl})`,
    ];
    if (gifUrl) {
      linksList.push(`[GIF](${gifUrl})`);
    }

    const bannerEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} Banner de ${fetchedUser.username}`,
      description: `📥 **Downloads (1024px):** ${linksList.join(' • ')}`,
      image: { url: embedBannerUrl },
      color: fetchedUser.accentColor ?? undefined,
      fields: [
        {
          name: `${e.USER} Usuário`,
          value: `**${fetchedUser.username}** (\`${fetchedUser.tag}\`)`,
          inline: true,
        },
        {
          name: `${e.ID} ID`,
          value: `\`${fetchedUser.id}\``,
          inline: true,
        },
      ],
    });

    await ctx.reply({ embeds: [bannerEmbed] });
  },
};
