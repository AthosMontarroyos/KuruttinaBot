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
    .setName('server-icon')
    .setDescription('Exibe e disponibiliza para download o ícone/foto de perfil do servidor')
    .addStringOption((option) =>
      option
        .setName('servidor')
        .setDescription('ID numérico do servidor do Discord')
        .setRequired(false)
    ),

  prefixAliases: ['server-icon', 'servericon', 'server-avatar', 'serveravatar', 'sicon', 'sav', 'serverpfp', 'icone'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!server-icon [id_servidor] ou /server-icon [servidor:<id>]',
    examples: [
      '/server-icon',
      '/server-icon servidor:123456789012345678',
      'k!server-icon',
      'k!server-icon 123456789012345678',
      'k!sicon 123456789012345678',
      'k!icone',
    ],
    detailedDescription:
      'Exibe em alta resolução (1024px) a foto/ícone de perfil do servidor atual ou de um servidor por ID. Servidores com Nível 1 de Impulso suportam ícones animados (GIF/APNG).',
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

    if (!targetGuild.icon) {
      await sendErrorReply(
        ctx,
        `${e.INFO} Ícone Não Configurado`,
        `O servidor **${targetGuild.name}** não possui um ícone customizado configurado.`
      );
      return;
    }

    const isAnimated = targetGuild.icon.startsWith('a_');

    // Discord CDN URLs using ?animated=true parameter for animated icons (Boost Level 1)
    const animatedWebpEmbedUrl = `https://cdn.discordapp.com/icons/${targetGuild.id}/${targetGuild.icon}.webp?animated=true&size=512`;
    const animatedWebpDownloadUrl = `https://cdn.discordapp.com/icons/${targetGuild.id}/${targetGuild.icon}.webp?animated=true&size=1024`;
    const pngUrl = `https://cdn.discordapp.com/icons/${targetGuild.id}/${targetGuild.icon}.png?size=1024`;

    const embedImageUrl = isAnimated ? animatedWebpEmbedUrl : pngUrl;
    const primaryBrowserUrl = isAnimated ? animatedWebpDownloadUrl : pngUrl;

    const iconEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${targetGuild.name}`,
      image: { url: embedImageUrl },
    });

    const actionRow: APIActionRowComponent<APIButtonComponent> = {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: 'Abrir ícone no navegador',
          url: primaryBrowserUrl,
        },
      ],
    };

    await ctx.reply({ embeds: [iconEmbed], components: [actionRow] });
  },
};
