import {
  SlashCommandBuilder,
  APIEmbed,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { STATUS_COLORS, DEFAULT_BOT_CONFIG, createCustomId } from '@kuruttina/shared';
import { CommandContext } from '../../../../types/command-context';
import { CommandModule } from '../../../../types/command-interface';
import { KuruttinaClient } from '../../../../types/kuruttina-client';
import { getEmoji } from '../../../../utils/emoji-resolver';

export const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Central de Ajuda e Diretório Paginado de Comandos da Kuruttina')
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
      'Exibe o menu interativo e paginado de comandos com botões de navegação lateral (◀ / ▶) e seletor de categorias.',
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

    // Resolve Live Emojis
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
          description: `Não foi possível localizar o comando \`${targetCommandName}\`. Verifique o nome ou navegue pelas páginas.`,
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

    // SCENARIO 2: Interactive Paginated Help Menu (◀ / ▶ Side Navigation)
    await ctx.deferReply(false);

    // Authorization checks for Dev & Affiliate scopes
    const isDevGuild = ctx.guild?.id === process.env.DEV_GUILD_ID;
    const isDevUser =
      ctx.user.id === process.env.CREATOR_ACCOUNT_ID || ctx.user.id === process.env.DEV_ACCOUNT_ID;
    const canSeeDevCommands = isDevGuild || isDevUser;

    // Build Automated Category Map: Map<categoryKey, Map<subCategoryKey, CommandModule[]>>
    const categoryMap = new Map<string, Map<string, CommandModule[]>>();

    client.commands.forEach((cmd) => {
      if (cmd.category === 'developer' && !canSeeDevCommands) return;
      if (cmd.category === 'affiliate' && !isDevGuild) return;

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

    // Build Help Pages Array (Page 0 = Home, Page 1..N = Categories)
    interface HelpPage {
      id: string;
      embed: APIEmbed;
    }

    const pages: HelpPage[] = [];

    // --- PAGE 0: Home / Summary ---
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

    pages.push({
      id: 'home',
      embed: {
        title: `${dancingEmoji} Central de Ajuda da Kuruttina`,
        description:
          `Olá! Sou a **Kuruttina**, estou aqui para te dar uma geral sobre como utilizar meus comandos 👍.\n\n` +
          `Navegue pelas páginas usando os **botões de seta (◀ / ▶)** ou escolha uma categoria no menu abaixo.`,
        color: STATUS_COLORS.INFO.number,
        fields: homeFields,
        footer: {
          text: `Página 1/${categoryMap.size + 1} • ${DEFAULT_BOT_CONFIG.BOT_NAME}`,
          icon_url: client.user?.displayAvatarURL(),
        },
        timestamp: new Date().toISOString(),
      },
    });

    // --- PAGES 1..N: Category Pages with Sub-Category Breakdown ---
    let catPageIndex = 2;
    const catKeysArray = Array.from(categoryMap.keys());

    for (const catKey of catKeysArray) {
      const subMap = categoryMap.get(catKey)!;
      const catEmoji = await getEmoji(client, catKey.toUpperCase() as any);

      let catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
      if (catKey === 'utility') catLabel = 'Utilidades';
      if (catKey === 'moderation') catLabel = 'Moderação';
      if (catKey === 'developer') catLabel = 'Desenvolvedor';
      if (catKey === 'affiliate') catLabel = 'Afiliados / Apoiadores';

      const subFields: { name: string; value: string; inline: boolean }[] = [];

      for (const [subKey, cmds] of subMap.entries()) {
        const subTitle = `📁 Subcategoria: ${subKey.charAt(0).toUpperCase() + subKey.slice(1)}`;
        const cmdList = cmds
          .map(
            (c) =>
              `• **/${c.data.name}** (Atalho: \`k!${c.prefixAliases?.[0] || c.data.name}\`)\n  _${c.data.description}_`
          )
          .join('\n');

        subFields.push({
          name: subTitle,
          value: cmdList || 'Nenhum comando.',
          inline: false,
        });
      }

      pages.push({
        id: `cat:${catKey}`,
        embed: {
          title: `${catEmoji} Categoria: ${catLabel}`,
          description: `Exibindo todas as subcategorias e comandos da categoria **${catLabel}**.`,
          color: STATUS_COLORS.INFO.number,
          fields: subFields,
          footer: {
            text: `Página ${catPageIndex}/${catKeysArray.length + 1} • ${DEFAULT_BOT_CONFIG.BOT_NAME}`,
            icon_url: client.user?.displayAvatarURL(),
          },
          timestamp: new Date().toISOString(),
        },
      });

      catPageIndex++;
    }

    // Build Component Action Rows Function
    let currentPageIndex = 0;

    const buildActionRows = (pageIdx: number) => {
      const prevCustomId = createCustomId('system', guildId, 'help', 'prev_page');
      const nextCustomId = createCustomId('system', guildId, 'help', 'next_page');
      const selectCustomId = createCustomId('system', guildId, 'help', 'select_category');

      // Buttons Action Row (◀ Anterior | ▶ Próximo | Diretório Web)
      const btnPrev = new ButtonBuilder()
        .setCustomId(prevCustomId)
        .setLabel('◀ Anterior')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIdx === 0);

      const btnNext = new ButtonBuilder()
        .setCustomId(nextCustomId)
        .setLabel('Próximo ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIdx === pages.length - 1);

      const btnWeb = new ButtonBuilder()
        .setLabel('Diretório Web Oficial')
        .setStyle(ButtonStyle.Link)
        .setURL('https://kuruttinabot.athosmontarroyos.com/commands');

      // Select Menu Action Row
      const selectOptions: { label: string; description: string; value: string; emoji?: string }[] = [
        {
          label: 'Início & Resumo (Página 1)',
          description: 'Retorna à página principal da Central de Ajuda',
          value: '0',
          emoji: '🏠',
        },
      ];

      catKeysArray.forEach((cKey, idx) => {
        let label = cKey.charAt(0).toUpperCase() + cKey.slice(1);
        if (cKey === 'utility') label = 'Utilidades';
        if (cKey === 'moderation') label = 'Moderação';
        if (cKey === 'developer') label = 'Desenvolvedor';
        if (cKey === 'affiliate') label = 'Afiliados';

        selectOptions.push({
          label: `${label} (Página ${idx + 2})`,
          description: `Navega para a categoria ${label}`,
          value: String(idx + 1),
        });
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(selectCustomId)
        .setPlaceholder('📂 Ir direto para uma Categoria...')
        .addOptions(selectOptions);

      const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(btnPrev, btnNext, btnWeb);
      const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      return { rowButtons, rowSelect, prevCustomId, nextCustomId, selectCustomId };
    };

    const initialRows = buildActionRows(currentPageIndex);

    const sentMessage = await ctx.reply({
      embeds: [pages[currentPageIndex].embed],
      components: [initialRows.rowButtons, initialRows.rowSelect],
    });

    if (!sentMessage) return;

    // Create Component Collector (Works universally for Slash AND Prefix commands!)
    const collector = sentMessage.createMessageComponentCollector({
      time: 120000, // 2 minutes
    });

    collector.on('collect', async (interaction) => {
      // Security check: Only allow command invoker to paginate
      if (interaction.user.id !== ctx.user.id) {
        const errEmoji = await getEmoji(client, 'WARNING');
        await interaction.reply({
          content: `${errEmoji} Apenas o usuário que usou o comando pode navegar nas páginas.`,
          flags: 64, // Ephemeral
        });
        return;
      }

      const { prevCustomId, nextCustomId, selectCustomId } = buildActionRows(currentPageIndex);

      if (interaction.customId === prevCustomId) {
        if (currentPageIndex > 0) currentPageIndex--;
      } else if (interaction.customId === nextCustomId) {
        if (currentPageIndex < pages.length - 1) currentPageIndex++;
      } else if (interaction.customId === selectCustomId && interaction.isStringSelectMenu()) {
        const targetPage = parseInt(interaction.values[0], 10);
        if (!isNaN(targetPage) && targetPage >= 0 && targetPage < pages.length) {
          currentPageIndex = targetPage;
        }
      }

      const updatedRows = buildActionRows(currentPageIndex);

      await interaction.update({
        embeds: [pages[currentPageIndex].embed],
        components: [updatedRows.rowButtons, updatedRows.rowSelect],
      });
    });

    collector.on('end', async () => {
      try {
        const { prevCustomId, nextCustomId } = buildActionRows(currentPageIndex);
        const disabledPrev = new ButtonBuilder()
          .setCustomId(prevCustomId)
          .setLabel('◀ Anterior')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const disabledNext = new ButtonBuilder()
          .setCustomId(nextCustomId)
          .setLabel('Próximo ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const disabledWeb = new ButtonBuilder()
          .setLabel('Diretório Web Oficial')
          .setStyle(ButtonStyle.Link)
          .setURL('https://kuruttinabot.athosmontarroyos.com/commands');

        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          disabledPrev,
          disabledNext,
          disabledWeb
        );

        await sentMessage.edit({
          components: [disabledRow],
        });
      } catch {
        // Ignore if message deleted
      }
    });
  },
};
