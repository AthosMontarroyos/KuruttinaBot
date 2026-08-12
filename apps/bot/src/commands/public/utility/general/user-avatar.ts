import { SlashCommandBuilder, User } from 'discord.js';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { getEmojis, createKuruttinaEmbed, sendErrorReply } from '../../../../utils';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('user-avatar')
    .setDescription('Exibe e disponibiliza para download a foto de perfil de um usuário por menção ou ID')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Usuário do Discord para visualizar o avatar')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('ID numérico do usuário do Discord (ex: 123456789012345678)')
        .setRequired(false)
    ),

  prefixAliases: ['user-avatar', 'useravatar', 'avatar', 'av', 'pfp', 'foto', 'ic'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!user-avatar [usuario_ou_id] ou /user-avatar [usuario:<usuario>] [id:<id>]',
    examples: [
      '/user-avatar',
      '/user-avatar usuario:@Membro',
      '/user-avatar id:123456789012345678',
      'k!user-avatar',
      'k!avatar @Membro',
      'k!pfp 123456789012345678',
    ],
    detailedDescription:
      'Busca e exibe em alta resolução (1024px) a foto de perfil de qualquer usuário do Discord informando uma menção ou o ID da conta (mesmo que ele não esteja no servidor atual). Disponibiliza links de download em PNG, JPG, WEBP e GIF.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.deferReply();

    const e = await getEmojis(ctx.client);
    let targetUser: User | null = null;
    let targetId: string | null = null;

    if (ctx.isSlash && ctx.slashInteraction) {
      const explicitId = ctx.slashInteraction.options.getString('id');
      const optionUser = ctx.slashInteraction.options.getUser('usuario');

      if (explicitId) {
        const idMatch = explicitId.match(/\d{17,20}/);
        targetId = idMatch ? idMatch[0] : explicitId.trim();
      } else if (optionUser) {
        targetUser = optionUser;
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

    // Default to command author if no target specified
    if (!targetUser && !targetId) {
      targetUser = ctx.user;
    }

    // Fetch user by ID if specified
    if (!targetUser && targetId) {
      try {
        targetUser = await ctx.client.users.fetch(targetId);
      } catch {
        await sendErrorReply(
          ctx,
          `${e.ERROR} Usuário Não Encontrado`,
          `Não foi possível encontrar nenhum usuário do Discord com o ID \`${targetId}\`. Verifique se o ID está correto.`
        );
        return;
      }
    }

    if (!targetUser) {
      targetUser = ctx.user;
    }

    const avatarUrl = targetUser.displayAvatarURL({ size: 1024 });
    const pngUrl = targetUser.displayAvatarURL({ extension: 'png', size: 1024 });
    const jpgUrl = targetUser.displayAvatarURL({ extension: 'jpg', size: 1024 });
    const webpUrl = targetUser.displayAvatarURL({ extension: 'webp', size: 1024 });
    const isAnimated = targetUser.avatar?.startsWith('a_') ?? false;
    const gifUrl = isAnimated ? targetUser.displayAvatarURL({ extension: 'gif', size: 1024 }) : null;

    const linksList = [
      `[PNG](${pngUrl})`,
      `[JPG](${jpgUrl})`,
      `[WEBP](${webpUrl})`,
    ];
    if (gifUrl) {
      linksList.push(`[GIF](${gifUrl})`);
    }

    const avatarEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} Avatar de ${targetUser.username}`,
      description: `📥 **Downloads:** ${linksList.join(' • ')}`,
      image: { url: avatarUrl },
      fields: [
        {
          name: `${e.USER} Usuário`,
          value: `**${targetUser.username}** (\`${targetUser.tag}\`)`,
          inline: true,
        },
        {
          name: `${e.ID} ID`,
          value: `\`${targetUser.id}\``,
          inline: true,
        },
      ],
    });

    await ctx.reply({ embeds: [avatarEmbed] });
  },
};
