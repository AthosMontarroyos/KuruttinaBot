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
    .setName('server-icon')
    .setDescription('Exibe e disponibiliza para download a foto de perfil/ícone do servidor atual'),

  prefixAliases: ['server-icon', 'servericon', 'server-avatar', 'serveravatar', 'sicon', 'sav', 'serverpfp', 'icone'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!server-icon ou /server-icon',
    examples: [
      '/server-icon',
      'k!server-icon',
      'k!sicon',
      'k!serveravatar',
      'k!icone',
    ],
    detailedDescription:
      'Exibe em alta resolução (1024px) a foto/ícone de perfil do servidor atual. Servidores com Nível 1 de Impulso suportam ícones animados (GIF/APNG).',
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

    if (!ctx.guild.icon) {
      await sendErrorReply(
        ctx,
        `${e.INFO} Ícone Não Configurado`,
        `O servidor **${ctx.guild.name}** não possui um ícone customizado configurado.`
      );
      return;
    }

    const isAnimated = ctx.guild.icon.startsWith('a_');

    // Discord CDN URLs using ?animated=true parameter for animated icons (Boost Level 1)
    const animatedWebpEmbedUrl = `https://cdn.discordapp.com/icons/${ctx.guild.id}/${ctx.guild.icon}.webp?animated=true&size=512`;
    const animatedWebpDownloadUrl = `https://cdn.discordapp.com/icons/${ctx.guild.id}/${ctx.guild.icon}.webp?animated=true&size=1024`;
    const pngUrl = `https://cdn.discordapp.com/icons/${ctx.guild.id}/${ctx.guild.icon}.png?size=1024`;

    const embedImageUrl = isAnimated ? animatedWebpEmbedUrl : pngUrl;
    const primaryBrowserUrl = isAnimated ? animatedWebpDownloadUrl : pngUrl;

    const iconEmbed = createKuruttinaEmbed(ctx.client, {
      title: `${e.PHOTO} ${ctx.guild.name}`,
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
