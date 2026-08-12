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

  prefixAliases: ['user-avatar', 'userbanner', 'avatar', 'av', 'pfp', 'foto', 'ic'],
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
      'Busca e exibe em alta resolução (1024px) a foto de perfil de qualquer usuário do Discord por menção ou ID.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.deferReply();

    const e = await getEmojis(ctx.client);
    const targetUser = await resolveUser(ctx, null, { fallbackToAuthor: true });

    if (!targetUser) {
      await sendErrorReply(
        ctx,
        `${e.ERROR} Usuário Não Encontrado`,
        'Não foi possível encontrar o usuário especificado por menção ou ID. Verifique o valor informado.'
      );
      return;
    }

    const avatarUrl = targetUser.displayAvatarURL({ size: 1024 });

    const avatarEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${targetUser.username}`,
      image: { url: avatarUrl },
    });

    const actionRow: APIActionRowComponent<APIButtonComponent> = {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: 'Abrir avatar no navegador',
          url: avatarUrl,
        },
      ],
    };

    await ctx.reply({ embeds: [avatarEmbed], components: [actionRow] });
  },
};
