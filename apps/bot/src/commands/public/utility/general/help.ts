import {
  SlashCommandBuilder,
  APIEmbed,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG, createCustomId } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { KuruttinaClient } from '../../../../types/kuruttina-client';
import { getEmoji } from '../../../../utils/emoji-resolver';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Central de Ajuda e Diretório de Comandos da Kuruttina')
    .addStringOption((option) =>
      option
        .setName('comando')
        .setDescription('Nome do comando específico para ver instruções detalhadas')
        .setRequired(false)
    ),
  prefixAliases: ['help', 'ajuda', 'comandos', 'commands'],
  category: 'utility',
  subCategory: 'general',
  guide: {
    syntax: 'k!help [comando] ou /help [comando]',
    examples: ['/help', '/help comando:clear', 'k!help ping', 'k!ajuda'],
    detailedDescription:
      'Exibe o menu interativo e automatizado de comandos agrupados por categorias e subcategorias dinâmicas.',
  },

  async execute(ctx: CommandContext): Promise<void> {
    const client = ctx.client as KuruttinaClient;
    const guildId = ctx.guild?.id || 'global';

    // Parse specific command parameter if provided
    let targetCommandName: string | null = null;
    if (ctx.isSlash && ctx.slashInteraction) {
      targetCommandName = ctx.slashInteraction.options.getString('comando');
    } else if (ctx.args[0]) {
      targetCommandName = ctx.args[0].trim().toLowerCase();
    }

    // Resolve Live Emojis for Header & Categories
    const dancingEmoji = await getEmoji(client, 'DANCING');
    const searchEmoji = await getEmoji(client, 'SEARCH');

    // SCENARIO 1: Detailed Single Command View (/help <command>)
    if (targetCommandName) {
      const foundCommand = client.commands.find((cmd) => {
        if (cmd.data.name === targetCommandName?.toLowerCase()) return true;
        if (cmd.prefixAliases && cmd.prefixAliases.includes(targetCommandName!.toLowerCase())) return true;
        return false;
      });

      // Context-aware Scope Check for single command lookup
      const isDevGuild = ctx.guild?.id === process.env.DEV_GUILD_ID;
      const isDevUser =
        ctx.user.id === process.env.CREATOR_ACCOUNT_ID || ctx.user.id === process.env.DEV_ACCOUNT_ID;
      const canSeeDevCommands = isDevGuild || isDevUser;

      if (!foundCommand || (foundCommand.category === 'developer' && !canSeeDevCommands)) {
        const errorEmbed: APIEmbed = {
          title: `${searchEmoji} Comando Não Encontrado`,
          description: `Não foi possível localizar o comando \`${targetCommandName}\`. Verifique o nome ou selecione uma categoria no menu principal.`,
          color: STATUS_COLORS.ERROR.number,
        };
        await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
        return;
      }

      const guide = foundCommand.guide || {
        syntax: `/${foundCommand.data.name}`,
        examples: [`/${foundCommand.data.name}`],
        detailedDescription: foundCommand.data.description,
      };

      const commandDetailEmbed: APIEmbed = {
        title: `📖 Guia do Comando: /${foundCommand.data.name}`,
        description: guide.detailedDescription || foundCommand.data.description,
        color: STATUS_COLORS.INFO.number,
        fields: [
          {
            name: '📌 Sintaxe',
            value: `\`${guide.syntax}\``,
            inline: false,
          },
          {
            name: '💡 Exemplos de Uso',
            value: guide.examples.map((ex) => `• \`${ex}\``).join('\n') || 'Nenhum exemplo disponível.',
            inline: false,
          },
          {
            name: '🏷️ Categoria & Subcategoria',
            value: `\`${foundCommand.category.toUpperCase()}\` • Sub: \`${foundCommand.subCategory || 'geral'}\``,
            inline: true,
          },
        ],
        footer: {
          text: `${DEFAULT_BOT_CONFIG.BOT_NAME} • Diretório Completo`,
          icon_url: client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      };

      if (foundCommand.prefixAliases && foundCommand.prefixAliases.length > 0) {
        commandDetailEmbed.fields!.push({
          name: '🔄 Atalhos de Prefixo',
          value: foundCommand.prefixAliases.map((a) => `\`k!${a}\``).join(', '),
          inline: true,
        });
      }

      if (guide.requiredPermissions && guide.requiredPermissions.length > 0) {
        commandDetailEmbed.fields!.push({
          name: '🔐 Permissões Requeridas',
          value: guide.requiredPermissions.map((p) => `\`${p}\``).join(', '),
          inline: true,
        });
      }

      await ctx.reply({ embeds: [commandDetailEmbed], ephemeral: true });
      return;
    }

    // SCENARIO 2: Automated Dynamic Category & Subcategory Scanning
    await ctx.deferReply(false);

    // Context-Aware Scope Authorization Checks
    const isDevGuild = ctx.guild?.id === process.env.DEV_GUILD_ID;
    const isDevUser =
      ctx.user.id === process.env.CREATOR_ACCOUNT_ID || ctx.user.id === process.env.DEV_ACCOUNT_ID;
    const canSeeDevCommands = isDevGuild || isDevUser;

    // Automated Category & Sub-Category Map: Map<categoryName, Map<subCategoryName, CommandModule[]>>
    const categoryMap = new Map<string, Map<string, CommandModule[]>>();

    client.commands.forEach((cmd) => {
      // 1. Gatekeep Developer category commands if not in Dev Guild or not Dev user
      if (cmd.category === 'developer' && !canSeeDevCommands) {
        return;
      }

      // 2. Gatekeep Affiliate category commands if not in an authorized affiliate server
      if (cmd.category === 'affiliate' && !isDevGuild) {
        return;
      }

      const catKey = cmd.category.toLowerCase();
      const subKey = (cmd.subCategory || 'geral').toLowerCase();

      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, new Map());
      }

      const subMap = categoryMap.get(catKey)!;
      if (!subMap.has(subKey)) {
        subMap.set(subKey, []);
      }

      subMap.get(subKey)!.push(cmd);
    });

    // Build Main Home Summary Fields
    const homeFields: { name: string; value: string; inline: boolean }[] = [];

    for (const [catKey, subMap] of categoryMap.entries()) {
      const catEmoji = await getEmoji(client, catKey.toUpperCase() as any);
      let catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
      if (catKey === 'utility') catLabel = 'Utilidades';
      if (catKey === 'moderation') catLabel = 'Moderação';
      if (catKey === 'developer') catLabel = 'Desenvolvedor (Restrito)';
      if (catKey === 'affiliate') catLabel = 'Afiliados / Apoiadores';

      let totalCmdsCount = 0;
      const cmdNames: string[] = [];

      for (const cmds of subMap.values()) {
        totalCmdsCount += cmds.length;
        cmds.forEach((c) => cmdNames.push(`\`/${c.data.name}\``));
      }

      homeFields.push({
        name: `${catEmoji} ${catLabel} (${totalCmdsCount})`,
        value: cmdNames.join(', ') || 'Nenhum comando.',
        inline: false,
      });
    }

    // Build Main Home Embed
    const mainHelpEmbed: APIEmbed = {
      title: `${dancingEmoji} Central de Ajuda da Kuruttina`,
      description:
        `Olá! Sou a **Kuruttina**, sua assistente de alta performance para o Discord.\n\n` +
        `Use o **Menu de Seleção abaixo** para navegar pelas categorias e subcategorias dinâmicas ou digite \`/help <comando>\` para detalhes.`,
      color: STATUS_COLORS.INFO.number,
      fields: homeFields,
      footer: {
        text: `${DEFAULT_BOT_CONFIG.BOT_NAME} • Prefixo Padrão: ${DEFAULT_BOT_CONFIG.DEFAULT_PREFIX}`,
        icon_url: client.user?.displayAvatarURL(),
      },
      timestamp: new Date().toISOString(),
    };

    // Build Automated Select Menu Options
    const selectOptions: { label: string; description: string; value: string; emoji?: string }[] = [
      {
        label: 'Início & Resumo',
        description: 'Retorna ao menu principal da Central de Ajuda',
        value: 'home',
        emoji: '🏠',
      },
    ];

    for (const catKey of categoryMap.keys()) {
      let catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
      let catDesc = `Comandos automatizados da categoria ${catLabel}`;

      if (catKey === 'utility') {
        catLabel = 'Utilidades';
        catDesc = 'Comandos gerais de informação e utilidades';
      } else if (catKey === 'moderation') {
        catLabel = 'Moderação';
        catDesc = 'Ferramentas de moderação e purga de membros';
      } else if (catKey === 'developer') {
        catLabel = 'Desenvolvedor';
        catDesc = 'Comandos restritos de gestão de aplicação e emojis';
      } else if (catKey === 'affiliate') {
        catLabel = 'Afiliados / Apoiadores';
        catDesc = 'Comandos exclusivos ativados para servidores parceiros';
      }

      selectOptions.push({
        label: catLabel,
        description: catDesc,
        value: `cat:${catKey}`,
      });
    }

    const selectCustomId = createCustomId('system', guildId, 'help', 'select_category');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(selectCustomId)
      .setPlaceholder('📂 Escolha uma Categoria de Comandos...')
      .addOptions(selectOptions);

    // Build Web Directory Link Button
    const webButton = new ButtonBuilder()
      .setLabel('Diretório Web Oficial')
      .setStyle(ButtonStyle.Link)
      .setURL('https://kuruttinabot.athosmontarroyos.com/commands');

    const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(webButton);

    await ctx.reply({
      embeds: [mainHelpEmbed],
      components: [rowSelect, rowButtons],
    });

    // Handle Component Collector for Interactive Dynamic Menu
    if (ctx.isSlash && ctx.slashInteraction) {
      const collector = ctx.slashInteraction.channel?.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      collector?.on('collect', async (interaction) => {
        if (interaction.customId !== selectCustomId) return;

        const selectedValue = interaction.values[0];
        let updatedEmbed: APIEmbed;

        if (selectedValue === 'home') {
          updatedEmbed = mainHelpEmbed;
        } else if (selectedValue.startsWith('cat:')) {
          const catKey = selectedValue.replace('cat:', '');
          const subMap = categoryMap.get(catKey);
          const catEmoji = await getEmoji(client, catKey.toUpperCase() as any);

          let catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
          if (catKey === 'utility') catLabel = 'Utilidades';
          if (catKey === 'moderation') catLabel = 'Moderação';
          if (catKey === 'developer') catLabel = 'Desenvolvedor';
          if (catKey === 'affiliate') catLabel = 'Afiliados';

          const subFields: { name: string; value: string; inline: boolean }[] = [];

          if (subMap) {
            for (const [subKey, cmds] of subMap.entries()) {
              const subTitle = `📁 Subcategoria: ${subKey.charAt(0).toUpperCase() + subKey.slice(1)}`;
              const cmdList = cmds
                .map((c) => `• **/${c.data.name}** (Atalho: \`k!${c.prefixAliases?.[0] || c.data.name}\`)\n  _${c.data.description}_`)
                .join('\n');

              subFields.push({
                name: subTitle,
                value: cmdList || 'Nenhum comando.',
                inline: false,
              });
            }
          }

          updatedEmbed = {
            title: `${catEmoji} Categoria: ${catLabel}`,
            description: `Exibindo todas as subcategorias e comandos automatizados da categoria **${catLabel}**.`,
            color: STATUS_COLORS.INFO.number,
            fields: subFields,
            footer: {
              text: `${DEFAULT_BOT_CONFIG.BOT_NAME} • Use /help <comando> para detalhes`,
              icon_url: client.user?.displayAvatarURL(),
            },
            timestamp: new Date().toISOString(),
          };
        } else {
          updatedEmbed = mainHelpEmbed;
        }

        await interaction.update({ embeds: [updatedEmbed] });
      });
    }
  },
};
